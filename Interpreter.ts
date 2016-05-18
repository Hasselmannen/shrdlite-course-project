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
     * Interpret a parsed command into a logic formula describing the intended result.
     * 
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form (disjunction of conjunctions). See the dummy interpetation returned in the code for an example, which means ontop(a,floor) AND holding(b).
     * @throws An error when no valid interpretations can be found
     */
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {

        var interpretation : DNFFormula;
        var candidates : string[];

        // TODO: Not sure if required or not: Allow a more flexible location description
        // (right now it will search for objects fulfilling the description,
        // it won't try to create a destination that fulfills it if one does not already exist)

        if (cmd.command == "move" || cmd.command == "take") {

            if (!cmd.entity) throw new Error("No entity specified in move");
            candidates = findCandidates(cmd.entity, state);
            if (candidates.length < 1) throw new Error("No such entity found");

            switch (cmd.command) {
            case "move":
                var ids = cmd.location.entity.object.form == "floor" ? ["floor"] : undefined;
                var relativeToCandidates = findCandidates(cmd.location.entity, state, ids);
                interpretation = interpretMove(cmd, state, candidates, relativeToCandidates);
                break;
            case "take":
                interpretation = interpretTake(cmd, state, candidates);
                break;
            default:
            }
        } else if (cmd.command == "put") {
            var ids = cmd.location.entity.object.form == "floor" ? ["floor"] : undefined;
            var relativeToCandidates = findCandidates(cmd.location.entity, state, ids);
            interpretation = interpretPut(cmd, state, relativeToCandidates);
        }
        if (interpretation.length <= 0) throw new Error("No valid solution found for the utterance");
        return interpretation;
    }

    /**
     * Interpret a move command.
     * 
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @param candidates Entities that matches the description of what should be moved.
     * @param relativeToCandidates Entities that matches the description of what the destination is in relation to.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form.
     */
    function interpretMove(cmd : Parser.Command,
        state : WorldState,
        candidates : string[],
        relativeToCandidates : string[]) : DNFFormula {
        var interpretation : DNFFormula = [];

        if (cmd.entity.quantifier != "all" && cmd.location.entity.quantifier != "all") {
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
        }
        else {
            interpretation = CNFtoDNF(toCNF(candidates, relativeToCandidates, cmd.location.relation));
            interpretation = interpretation.filter((conjunction) => {
                return conjunction.every((literal) => {
                    var entity = state.objects[literal.args[0]];
                    var relativeTo  = literal.args[1] == "floor" ? { form : "floor", size : "" } : state.objects[literal.args[1]];
                    return Util.isValidRelation( 
                        { form : entity.form,     size : entity.size },
                        literal.relation,
                        { form : relativeTo.form, size : relativeTo.size}
                    );
                })
            });

            if (cmd.entity.quantifier == "all" && cmd.location.entity.quantifier == "all") {
                var filtered: Literal[] = [];
                for (var conjunction of interpretation) {
                    for (var literal of conjunction) {
                        if (!filtered.some((elem) => equalLiterals(elem, literal)))
                            filtered.push(literal);
                    }
                }
                interpretation = [filtered];
            }
        }
        return interpretation;
    }

    /**
     * Interpret a take command.
     * 
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @param candidates Entities that matches the description of what should be taken.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form.
     */
    function interpretTake(command : Parser.Command, worldState : WorldState, candidates : string[]) : DNFFormula {
        var interpretation : DNFFormula = [];
        for (var candidate of candidates) {
            interpretation.push([
                {
                    polarity: true,
                    relation: "holding",
                    args: [candidate]
                }
            ]);
        }
        return interpretation;
    }

    /**
     * Interpret a put command.
     * 
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @param relativeToCandidates Entities that matches the description of where the item is to be put.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form.
     */
    function interpretPut(cmd : Parser.Command, state : WorldState, relativeToCandidates : string[]) : DNFFormula {
        var interpretation : DNFFormula = [];
        if (!state.holding) throw new Error("Not holding any object");
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
        return interpretation;
    }

    /**
     * Determines whether or not a proposed candidate is a valid candidate.
     *
     * @param obj Positional information about the candidate.
     * @param descr A description of the candidate.
     * @param state The state of the world.
     * @returns True if the proposed candidate is valid.
     */
    function isCandidate(obj : Util.WorldObject, descr : Parser.Entity, state : WorldState) : boolean {

        var properties = ["color", "size"];
        if (descr.object.form != "anyform" && (!descr.object.object || descr.object.object.form != "anyform"))
            properties.push("form");

        // Make sure that all defined properties hold for the object
        var validProps : boolean = properties.every((prop) => {
            var lhs : string = descr.object.object ? (<any>descr.object.object)[prop] : (<any>descr.object)[prop];
            if (lhs) {
                let rhs : string = (<any>state.objects[obj.id])[prop];
                return lhs == rhs;
            }
            return true;
        });
        if (!validProps) return false;

        // Make sure that, if a location is specified, it exists in the world,
        var validLocation : boolean = true;

        if (descr.object.location) {
            if (descr.quantifier != "all") {
	            var candidates = findCandidates(
	                descr.object.location.entity,
	                state,
	                obj.findRelated(state.stacks, descr.object.location.relation)
	            );
	            validLocation = !!candidates.length;
       	    }
            else {
                var related = obj.findRelated(state.stacks, descr.object.location.relation);
                var candidates = findCandidates(descr.object.location.entity, state);
                validLocation = candidates.length && candidates.every((id) => !!~related.indexOf(id));
            }
        }

        return validLocation;
    }

    /**
     * Identifies which objects in the world that satisfy a given description of an object.
     *
     * @param descr An entity description
     * @param state The state of the world.
     * @param ids A list of identifiers to which to restrict the identification.
     * @returns A list of candidates that satisfy the description of the object.
     */
    function findCandidates(descr : Parser.Entity, state : WorldState, ids? : string[]) : string[] {
        var candidates : Util.WorldObject[] = [];

        // Special case for floor (TODO: ???)
        if (descr.object.form == "floor" && (!ids || ids && ids.indexOf("floor") !== -1))
            return ["floor"];

        // For each object in each stack
        state.stacks.forEach((stack, x) => {
            stack.forEach((obj, y) => {
                // Skip object if it is not in list of potential candidates
                if (ids && ids.indexOf(obj) === -1) return;
                // Add to list of candidates if it is a candidate
                var worldObject = new Util.WorldObject(obj, x, y);
                if (isCandidate(worldObject, descr, state))
                    candidates.push(worldObject);
            })
        });

        // Also add the object that the arm is holding to the list of candidates.
        if (state.holding && (!ids || ids && ids.indexOf(state.holding) !== -1)) {
            var worldObject = new Util.WorldObject(state.holding, -1, -1);
            if (isCandidate(worldObject, descr, state))
                candidates.push(worldObject);
        }

        // Handle quantifiers
        switch (descr.quantifier) {
        case "the":
            if (candidates.length > 1) throw new Error("Ambiguous entity");
            break;
        default:
            break;
        }

        return candidates.map((candidate) => candidate.id);
    }

    function toCNF(arr1: string[], arr2: string[], relation: string): Literal[][] {
        var conjunction: Literal[][] = [];
        for (var elem1 of arr1) {
            var disjunction: Literal[] = [];
            for (var elem2 of arr2) {
                disjunction.push({
                    polarity: true,
                    relation: relation,
                    args: [elem1, elem2]
                });
            }
            conjunction.push(disjunction);
        }
        return conjunction;
    }

    function CNFtoDNF(conjunction: Literal[][]): DNFFormula {
        function CNFtoDNF(curr: DNFFormula, rest: Literal[][]): DNFFormula {
            if (!rest.length) return curr;
            var next: DNFFormula = [];
            for (var literal of rest[0]) {
                if (!curr.length) {
                    next.push([literal]);
                }
                else {
                    next = next.concat(curr.map((conjunction) => conjunction.concat([literal])));
                }
            }
            return CNFtoDNF(next, rest.slice(1));
        }
        return CNFtoDNF([], conjunction);
    }

    function equalLiterals(lhs: Literal, rhs: Literal): boolean {
        return lhs.args[0] == rhs.args[0] && lhs.args[1] == rhs.args[1] &&
               lhs.polarity == rhs.polarity && lhs.relation == rhs.relation;
    }
}
