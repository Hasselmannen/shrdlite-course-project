///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Graph.ts"/>
///<reference path="lib/collections.ts"/>
///<reference path="Util.ts" />

/**
* Planner module
*
* The goal of the Planner module is to take the interpetation(s)
* produced by the Interpreter module and to plan a sequence of actions
* for the robot to put the world into a state compatible with the
* user's command, i.e. to achieve what the user wanted.
*
* The planner should use your A* search implementation to find a plan.
*/
module Planner {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    /**
     * Top-level driver for the Planner. Calls `planInterpretation` for each given interpretation generated by the Interpreter.
     * @param interpretations List of possible interpretations.
     * @param currentState The current state of the world.
     * @returns Augments Interpreter.InterpretationResult with a plan represented by a list of strings.
     */
    export function plan(interpretations : Interpreter.InterpretationResult[], currentState : WorldState) : PlannerResult[] {
        var errors : Error[] = [];
        var plans : PlannerResult[] = [];
        interpretations.forEach((interpretation) => {
            try {
                var result : PlannerResult = <PlannerResult>interpretation;
                result.plan = planInterpretation(result.interpretation, currentState);
                if (result.plan.length == 0) {
                    result.plan.push("That is already true!");
                }
                plans.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (plans.length) {
            return plans;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface PlannerResult extends Interpreter.InterpretationResult {
        plan : string[];
    }

    export function stringify(result : PlannerResult) : string {
        return result.plan.join(", ");
    }

    //////////////////////////////////////////////////////////////////////
    // private functions

    class SearchState {
        constructor(
            public stacks : Stack[],
            public holding : string, // Invariant: holding may not be empty string
            public arm : number
        ) { }
    }

    function worldToSearchState(worldState : WorldState) : SearchState {
        return new SearchState(
            worldState.stacks.map((stack) => stack.slice()),
            worldState.holding,
            worldState.arm);
    }

    class SearchStateGraph implements Graph<SearchState> {

        constructor(public worldObjects: {[s:string]: ObjectDefinition}){ }
        // TODO: Add members if necessary

        outgoingEdges(node : SearchState) : Edge<SearchState>[] {

            console.log("Edgestuff: " + node.stacks + " holding: " + node.holding);


            // TODO: Implement this
            var edges: Edge<SearchState>[] = [];
            // Possible to move left?
            if (node.arm > 0) {
                var edge = new Edge<SearchState>();
                edge.from = node;
                edge.to = new SearchState(
                    node.stacks.map((stack) => stack.slice()),
                    node.holding,
                    node.arm - 1);
                edge.cost = 1; //TODO maybe change this later

                edges.push(edge);
            }
            // Possible to move right?
            if (node.arm < node.stacks.length -1) {
                var edge = new Edge<SearchState>();
                edge.from = node;
                edge.to = new SearchState(
                    node.stacks.map((stack) => stack.slice()),
                    node.holding,
                    node.arm + 1);
                edge.cost = 1; //TODO maybe change this later

                edges.push(edge);
            }
            // Possible to pick upp object?
            if (!node.holding && node.stacks[node.arm].length > 0) {
                var edge = new Edge<SearchState>();
                edge.from = node;
                var tempStacks = node.stacks.map((stack) => stack.slice());
                var hold: string = tempStacks[node.arm].pop();
                edge.to = new SearchState(
                    tempStacks,
                    hold,
                    node.arm);
                edge.cost = 1; //TODO maybe change this later

                edges.push(edge);

            // Holding something
            } else if (node.holding) {
                if (node.stacks[node.arm].length == 0) { // If floor, we can drop object
                    var edge = new Edge<SearchState>();
                    edge.from = node;
                    var tempStacks = node.stacks.map((stack) => stack.slice());
                    tempStacks[node.arm].push(node.holding);
                    edge.to = new SearchState(
                        tempStacks,
                        null,
                        node.arm);
                    edge.cost = 1; //TODO maybe change this later

                    edges.push(edge);
                } else {
                    var topmostObject: string =
                        node.stacks[node.arm][node.stacks[node.arm].length-1];
                    var objectData: ObjectDefinition = this.worldObjects[topmostObject];
                    var holdingData: ObjectDefinition = this.worldObjects[node.holding];
                    var relation = objectData.form == "box" ? "inside" : "ontop";
                    if (Util.isValidRelation(
                            {form:holdingData.form, size:holdingData.size},
                            relation,
                            {form:objectData.form, size:objectData.size})) {
                        var edge = new Edge<SearchState>();
                        edge.from = node;
                        var tempStacks = node.stacks.map((stack) => stack.slice());
                        tempStacks[node.arm].push(node.holding);
                        edge.to = new SearchState(
                            tempStacks,
                            null,
                            node.arm);
                        edge.cost = 1; //TODO maybe change this later

                        edges.push(edge);
                    }

                }

            }
            return edges;
        }

        compareNodes(lhs : SearchState, rhs : SearchState) : number {
            return 0; // Honestly, we probably really don't care about this function at all. Likely unusued.
        }
    }

    /**
     * A function that, given an interpretation, supplies a goal function which in
     * turn can check whether or not a node is a goal state.
     *
     * @param interpretation A disjunction of conjunctions describing what is required for a goal state.
     * @returns A goal function that returns true if a provided node satisfies the interpretation.
     */
    function goal(interpretation : Interpreter.DNFFormula) : (node : SearchState) => boolean {
        return (node) => interpretation.some((conjunction) => {
            return conjunction.every((literal) => {
                // Special case when holding an object
                if (literal.relation == "holding") {
                    if (literal.args[0] == node.holding) return true;
                    else return false;
                }
                if (literal.args[1] == "floor" && literal.relation == "ontop") {
                    return node.stacks.some((stack) => stack[0] == "floor");
                }

                // TODO: For now not very well coded stuff, need to refactor functions from Interpreter to a Util module
                var id = literal.args[0];
                if (id == node.holding) return false;

                var stack : number = Util.findStack(id, node.stacks);
                var entity = new Util.WorldObject(id, stack, node.stacks[stack].indexOf(id));
                var relation = literal.relation;
                var relativeTo = literal.args[1];
                var ids = entity.findRelated(node.stacks, relation);
                if (ids.indexOf(relativeTo) !== -1) return true;
                else return false;
            });
        });
    }

//function goal(interpretation : Interpreter.DNFFormula) : (node : SearchState) => boolean { return (node) => false; }

    function heuristics(interpretation : Interpreter.DNFFormula) : (node : SearchState) => number {
        return (node) => 0;
    }

    function convertPathToPlan(path : SearchResult<SearchState>) : string[] {

        var plan : string[] = [];

        // Go through the whole path, for each node look at the current one and the next one to find the difference
        for (var i : number = 0; i < path.path.length - 1; ++i) {
            var current = path.path[i];
            var next = path.path[i+1];

            // Check if arm moved left
            if (current.arm > next.arm) {
                plan.push("l");
                continue;
            }

            // Check if arm moved right
            if (current.arm < next.arm) {
                plan.push("r");
                continue;
            }

            // Check if arm picked up something
            if (!current.holding && !!next.holding) {
                plan.push("p");
                continue;
            }

            // Check if arm dropped something
            if (!!current.holding && !next.holding) {
                plan.push("d");
                continue;
            }
        }

        return plan;
    }

    /**
     * The core planner function. The code here is just a template;
     * you should rewrite this function entirely. In this template,
     * the code produces a dummy plan which is not connected to the
     * argument `interpretation`, but your version of the function
     * should be such that the resulting plan depends on
     * `interpretation`.
     *
     *
     * @param interpretation The logical interpretation of the user's desired goal. The plan needs to be such that by executing it, the world is put into a state that satisfies this goal.
     * @param state The current world state.
     * @returns Basically, a plan is a
     * stack of strings, which are either system utterances that
     * explain what the robot is doing (e.g. "Moving left") or actual
     * actions for the robot to perform, encoded as "l", "r", "p", or
     * "d". The code shows how to build a plan. Each step of the plan can
     * be added using the `push` method.
     */
    function planInterpretation(interpretation : Interpreter.DNFFormula, state : WorldState) : string[] {

        // Create parameters for a* search
        var initialState = worldToSearchState(state);
        var graph = new SearchStateGraph(state.objects);
        var goalFunc = goal(interpretation);
        var heuristicsFunc = heuristics(interpretation);
        var timeout = 60; // 1 minute should be enough for anyone :v

        // Call a* and retreive path
        var path = aStarSearch<SearchState>(graph, initialState, goalFunc, heuristicsFunc, timeout);

        // Convert path to plan
        return convertPathToPlan(path);
    }

}
