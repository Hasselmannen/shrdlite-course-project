///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Graph.ts"/>
///<reference path="lib/collections.ts"/>

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
        // TODO: Implement initial conversion from WorldState to SearchState
        return null;
    }

    class SearchStateGraph implements Graph<SearchState> {

        // TODO: Add members and constructors if necessary

        outgoingEdges(node : SearchState) : Edge<SearchState>[] {
            // TODO: Implement this
            return null;
        }

        compareNodes(lhs : SearchState, rhs : SearchState) : number {
            return 0; // Honestly, we probably really don't care about this function at all. Likely unusued.
        }
    }

    function goal(interpretation : Interpreter.DNFFormula) : (node : SearchState) => boolean {
        return (node) => false;
    }

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
        var graph = new SearchStateGraph();
        var goalFunc = goal(interpretation);
        var heuristicsFunc = heuristics(interpretation);
        var timeout = 60; // 1 minute should be enough for anyone :v

        // Call a* and retreive path
        var path = aStarSearch<SearchState>(graph, initialState, goalFunc, heuristicsFunc, timeout);

        // Convert path to plan
        return convertPathToPlan(path);
    }

}
