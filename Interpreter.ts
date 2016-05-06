///<reference path="World.ts"/>
///<reference path="Parser.ts"/>

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
    export function interpret(parses: Parser.ParseResult[], currentState: WorldState): InterpretationResult[] {
        var errors: Error[] = [];
        var interpretations: InterpretationResult[] = [];
        parses.forEach((parseresult) => {
            try {
                var result: InterpretationResult = <InterpretationResult>parseresult;
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
        interpretation: DNFFormula;
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
        polarity: boolean;
        /** The name of the relation in question. */
        relation: string;
        /** The arguments to the relation. Usually these will be either objects
         * or special strings such as "floor" or "floor-N" (where N is a column) */
        args: string[];
    }

    export function stringify(result: InterpretationResult): string {
        return result.interpretation.map((literals) => {
            return literals.map((lit) => stringifyLiteral(lit)).join(" & ");
            // return literals.map(stringifyLiteral).join(" & ");
        }).join(" | ");
    }

    export function stringifyLiteral(lit: Literal): string {
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
    function interpretCommand(cmd: Parser.Command, state: WorldState): DNFFormula {

        var interpretation: DNFFormula = [];

        switch (cmd.command) {
            case "move":
                if (!cmd.entity) throw "No entity specified in move.";
                var entities: string[] = findCandidates(cmd.entity.object, state);
                if (entities.length < 1) throw "No such entity found."
                switch (cmd.entity.quantifier) {
                    case "any":
                        //cmd.entity.
                        break;
                    case "the":
                        if (entities.length > 1) throw "Ambiguous entity."


                        break;
                    case "all":
                        break;
                }
                var relationTo: string[] = findCandidates(cmd.location.entity.object, state);

                for (var entity of entities) {
                    for (var relativeTo of relationTo) {
                        if (entity == relativeTo) continue;
                        interpretation.push([
                            { polarity : true,
                              relation : cmd.location.relation,
                              args     : [entity, relativeTo] }
                        ]);
                    }
                }

                break;
            case "put":
                break;
            case "take":
                break;
        }

/*
        // This returns a dummy interpretation involving two random objects in the world
        var objects: string[] = Array.prototype.concat.apply([], state.stacks);
        var a: string = objects[Math.floor(Math.random() * objects.length)];
        var b: string = objects[Math.floor(Math.random() * objects.length)];
        interpretation = [[
            { polarity: true, relation: "ontop", args: [a, "floor"] },
            { polarity: true, relation: "holding", args: [b] }
        ]];*/
        return interpretation;
    }




    /**
     * Finds the index in the stack to which the given id belongs in the given
     * list of stacks.
     * @param id The id of the object to be located.
     * @param stacks The list of the world's stacks.
     * @returns The index of the stack to which the id belongs, or -1 if it could not be located.
     */
    function findStack(id: string, stacks: string[][]): number {
        for (var i = stacks.length - 1; i >= 0; i--) {
            if (stacks[i].indexOf(id) !== -1) return i;
        }
        return -1;
    }

    /**
     * A class containing positional data about an object in a world.
     */
    class Candidate {
        /**
         * @param id The unique identifer of the object.
         * @param stack The index of the stack to which this object belongs.
         * @param pos This object's position in its stack.
         */
        constructor(
            public id: string,
            public stack: number,
            public pos: number
        ) { }

        /**
         * Given a list of stacks and a positional relation, returns the
         * identifiers of objects which are positioned so that the relation
         * is satisfied.
         *
         * TODO: Does not yet handle quantifiers or floors.
         *
         * @param stacks The stacks of the world.
         * @param relation The positional relation of this object to other objects in the world.
         * @returns A list of identifiers that satisfy the relation.
         */
        findRelated(stacks: string[][], relation: string): string[] {
            switch (relation) {
                case "leftof":
                    return this.stack < stacks.length ?
                        stacks[this.stack + 1] : [];
                case "rightof":
                    return this.stack > 0 ? stacks[this.stack - 1] : [];
                case "ontop":
                    return this.pos > 0 ?
                        [stacks[this.stack][this.pos - 1]] : [];
                case "under":
                    return stacks[this.stack].slice(
                        stacks[this.stack].indexOf(this.id) + 1);
                case "beside":
                    return (this.stack > 0 ?
                        stacks[this.stack - 1] : []).concat(
                        this.stack < stacks.length - 1 ?
                            stacks[this.stack + 1] : []);
                case "above":
                    return stacks[this.stack].slice(
                        0, stacks[this.stack].indexOf(this.id) - 1);
            }
        }
    }

    /**
     * Identifies which objects in the world that satisfy a given description of an object.
     *
     * @param obj A description of the object to identify.
     * @param state The state of the world.
     * @param ids A list of identifiers to which to restrict the identification.
     * @returns A list of candidates that satisfy the description of the object.
     */
    function findCandidates(obj: Parser.Object, state: WorldState, ids?: string[]): string[] {

        var candidates: Candidate[] = [];
        var keys: string[] = ids || Object.keys(state.objects);

        for (var id of keys) {
            var stack: number = findStack(id, state.stacks);
            candidates.push(
                new Candidate(id, stack, state.stacks[stack].indexOf(id))
            );
        }

        for (var prop of ["color", "form", "size"]) {
            if (obj[prop]) {
                candidates = candidates.filter((candidate) =>
                    state.objects[candidate.id][prop] == obj[prop]);
            }
        }

        if (obj.location) {
            candidates = candidates.filter((candidate) =>
                findCandidates(
                    obj.location.entity.object,
                    state,
                    candidate.findRelated(state.stacks, obj.location.relation)
                ).length > 0)
        }

        return candidates.map((candidate) => candidate.id);
    }
}
