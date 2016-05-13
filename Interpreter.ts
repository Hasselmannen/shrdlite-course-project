///<reference path="World.ts"/>
///<reference path="Parser.ts"/>
///<reference path="Util.ts" />

/**
* Interpreter module
*
* The goal of the Interpreter module is to interpret a sentence
* written by the user in the context of the current world state. In
* particular, it must figure out which objects in the world,
* i.e. which elements in the `objects` field of WorldState, correspond
* to the ones referred to in the sentence.
*
* Moreover, it has to derive what the intended goal state is and
* return it as a logical formula described in terms of literals, where
* each literal represents a relation among objects that should
* hold. For example, assuming a world state where "a" is a ball and
* "b" is a table, the command "put the ball on the table" can be
* interpreted as the literal ontop(a,b). More complex goals can be
* written using conjunctions and disjunctions of these literals.
*
* In general, the module can take a list of possible parses and return
* a list of possible interpretations, but the code to handle this has
* already been written for you. The only part you need to implement is
* the core interpretation function, namely `interpretCommand`, which produces a
* single interpretation for a single command.
*/
module Interpreter {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    /**
    Top-level function for the Interpreter. It calls `interpretCommand` for each possible parse of the command. No need to change this one.
    * @param parses List of parses produced by the Parser.
    * @param currentState The current state of the world.
    * @returns Augments ParseResult with a list of interpretations. Each interpretation is represented by a list of Literals.
    */
    export function interpret(parses : Parser.ParseResult[], currentState : WorldState) : InterpretationResult[] {

        var errors : Error[] = [];
        var interpretations : InterpretationResult[] = [];
        parses.forEach((parseresult) => {
            try {
                var result : InterpretationResult = <InterpretationResult>parseresult;

                result.interpretation = interpretCommand(result.parse, currentState);
                interpretations.push(result);
            } catch (err) {
                errors.push(err);
            }
        });
        if (interpretations.length) {
            return interpretations;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface InterpretationResult extends Parser.ParseResult {
        interpretation : DNFFormula;
    }

    export type DNFFormula = Conjunction[];
    type Conjunction = Literal[];

    /**
    * A Literal represents a relation that is intended to
    * hold among some objects.
    */
    export interface Literal {
        /** Whether this literal asserts the relation should hold
         * (true polarity) or not (false polarity). For example, we
         * can specify that "a" should *not* be on top of "b" by the
         * literal {polarity: false, relation: "ontop", args:
         * ["a","b"]}.
         */
        polarity : boolean;
        /** The name of the relation in question. */
        relation : string;
        /** The arguments to the relation. Usually these will be either objects
         * or special strings such as "floor" or "floor-N" (where N is a column) */
        args : string[];
    }

    export function stringify(result : InterpretationResult) : string {
        return result.interpretation.map((literals) => {
            return literals.map((lit) => stringifyLiteral(lit)).join(" & ");
            // return literals.map(stringifyLiteral).join(" & ");
        }).join(" | ");
    }

    export function stringifyLiteral(lit : Literal) : string {
        return (lit.polarity ? "" : "-") + lit.relation + "(" + lit.args.join(",") + ")";
    }

    //////////////////////////////////////////////////////////////////////
    // private functions
    /**
     * The core interpretation function. The code here is just a
     * template; you should rewrite this function entirely. In this
     * template, the code produces a dummy interpretation which is not
     * connected to `cmd`, but your version of the function should
     * analyse cmd in order to figure out what interpretation to
     * return.
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form (disjunction of conjunctions). See the dummy interpetation returned in the code for an example, which means ontop(a,floor) AND holding(b).
     */
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {
        var interpretation : DNFFormula = [];

        var candidates : string[];

        // TODO: Not sure if required or not: Allow a more flexible location description
        // (right now it will search for objects fulfilling the description,
        // it won't try to create a destination that fulfills it if one does not already exist)

        if (cmd.command == "move" || cmd.command == "take") {
            if (!cmd.entity) throw "No entity specified in move";
            candidates = findCandidates(cmd.entity, state);
            if (candidates.length < 1) throw "No such entity found";
        }

        var relativeToCandidates : string[];

        if (cmd.command == "move" || cmd.command == "put") {
            var subjectSearchEntity = cmd.location.entity;
            var ids = subjectSearchEntity.object.form == "floor" ? ["floor"] : undefined;
            relativeToCandidates = findCandidates(subjectSearchEntity, state, ids);
        }

        if (cmd.command == "move") {
            for (var candidate of candidates) {
                for (var relativeTo of relativeToCandidates) {
                    if (candidate == relativeTo) continue;
                    if (Util.isValidRelation(
                        state.objects[candidate],
                        cmd.location.relation,
                        relativeTo == "floor" ? { form: "floor" } : state.objects[relativeTo])
                    ) {
                        interpretation.push([
                            {
                                polarity: true,
                                relation: cmd.location.relation,
                                args: [candidate, relativeTo]
                            }
                        ]);
                    }
                }
            }
        } else if (cmd.command == "take") {
            for (var candidate of candidates) {
                interpretation.push([
                    {
                        polarity: true,
                        relation: "holding",
                        args: [candidate]
                    }
                ]);
            }
        } else if (cmd.command == "put") {
            if (!state.holding) throw "Not holding any object";
            for (var relativeTo of relativeToCandidates) {
                if (state.holding == relativeTo) continue;
                if (Util.isValidRelation(
                    state.objects[state.holding],
                    cmd.location.relation,
                    relativeTo == "floor" ? { form: "floor" } : state.objects[relativeTo])
                ) {
                    interpretation.push([
                        {
                            polarity: true,
                            relation: cmd.location.relation,
                            args: [state.holding, relativeTo]
                        }
                    ]);
                }
            }
        }

        if (interpretation.length <= 0) throw "No valid solution found for the utterance";

        return interpretation;
    }

    // TODO: possibly add support for referring to the object that the arm is currently holding.
    /**
     * Identifies which objects in the world that satisfy a given description of an object.
     *
     * @param entity An entity description..
     * @param state The state of the world.
     * @param ids A list of identifiers to which to restrict the identification.
     * @returns A list of candidates that satisfy the description of the object.
     */
    function findCandidates(entity : Parser.Entity, state : WorldState, ids? : string[]) : string[] {
        var obj = entity.object;
        if (obj.form == "floor" && ids && ids.indexOf("floor") !== -1)
            return ["floor"];

        var candidates : Util.WorldObject[] = [];
        var keys : string[] = ids || Object.keys(state.objects);

        for (var id of keys) {
            var stack : number = Util.findStack(id, state.stacks);
            if (stack === -1) continue;
            candidates.push(
                new Util.WorldObject(id, stack, state.stacks[stack].indexOf(id))
            );
        }

        var properties = ["color", "size"];
        if (obj.form != "anyform" && (!obj.object || obj.object.form != "anyform")) properties.push("form");
        for (var prop of properties) {
            var lhs : string = obj.object ? (<any>obj.object)[prop] : (<any>obj)[prop];
            if (lhs) {
                candidates = candidates.filter(candidate => {
                    let rhs : string = (<any>state.objects[candidate.id])[prop];
                    return lhs == rhs;
                });
            }
        }

        if (obj.location) {
            candidates = candidates.filter(candidate => {
                var candidates = findCandidates(
                    obj.location.entity,
                    state,
                    candidate.findRelated(state.stacks, obj.location.relation)
                );
                return !!candidates.length;
            });
        }

        switch (entity.quantifier) {
        case "all":
            throw "Quantifier 'all' is not supported";
        case "the":
            if (candidates.length > 1) throw "Ambiguous entity";
            break;
        default:
            break;
        }

        return candidates.map((candidate) => candidate.id);
    }
}
