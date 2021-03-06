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
* The planner uses A* search to find a plan.
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
                var result = <PlannerResult>interpretation;
                result.plan = planInterpretation(result.interpretation, currentState);
                if (result.plan.length == 0) {
                    result.plan.push("That is already true!");
                }
                plans.push(result);
            } catch (err) {
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

    // Const contants used to calculate cost and heuristics
    const MOVE_COST = 1; // Cost for moving the arm 1 step
    const CARRY_COST = 2; // Additional cost for carrying an object 1 step
    const CARRY_LARGE_COST = 2; // Additional cost for carrying a large object 1 step (cost = move+carry+carryLarge)
    const MAX_PICKUP_COST = 10; // The maximum cost for picking up an object, actual cost depends on size of stack.

    // The cost of picking up an object in a stack
    // @param numObjects the number of objects in the world
    // @param stacks the stacks of objects in the world
    // @param stack the index of the stack we want to pick up from
    function pickUpCost(numObjects : number, stacks : string[][], stack : number) : number {
        // cost = (Base action cost = 1) + extra pickup cost
        return 1 + MAX_PICKUP_COST * (numObjects - stacks[stack].length) / numObjects;
    }

    // The state of the world in a given instance, used for a*
    class SearchState {
        constructor(
            public stacks : Stack[],
            public holding : string, // Invariant: holding may not be empty string
            public arm : number
        ) { }

        toString() : string {
            return collections.makeString(this);
        }
    }

    // Converts a world state to a search state
    function worldToSearchState(worldState : WorldState) : SearchState {
        return new SearchState(
            worldState.stacks.map((stack) => stack.slice()),
            worldState.holding,
            worldState.arm);
    }

    // The graph of search states used for a*. Contains the algorithm used to calculate cost.
    class SearchStateGraph implements Graph<SearchState> {

        public numObjects : number;
        public worldObjects : { [s : string] : ObjectDefinition };

        constructor(public worldState : WorldState) {
            this.worldObjects = worldState.objects;
            this.numObjects = [].concat.apply([], worldState.stacks).length;
        }

        // Returns the possible search states reachable from this search state and the cost to do so
        outgoingEdges(node : SearchState) : Edge<SearchState>[] {
            var edges : Edge<SearchState>[] = [];
            // Possible to move left?
            if (node.arm > 0) {
                var edge = new Edge<SearchState>();
                edge.from = node;
                edge.to = new SearchState(
                    node.stacks.map((stack) => stack.slice()),
                    node.holding,
                    node.arm - 1);
                edge.cost = MOVE_COST;
                // More expensive to carry objects
                if (node.holding) {
                    edge.cost += CARRY_COST;
                    // Even more expensive to carry large objects
                    if (this.worldObjects[node.holding].size === "large")
                        edge.cost += CARRY_LARGE_COST;
                }

                edges.push(edge);
            }
            // Possible to move right?
            if (node.arm < node.stacks.length - 1) {
                var edge = new Edge<SearchState>();
                edge.from = node;
                edge.to = new SearchState(
                    node.stacks.map((stack) => stack.slice()),
                    node.holding,
                    node.arm + 1);
                edge.cost = MOVE_COST;
                // More expensive to carry objects
                if (node.holding) {
                    edge.cost += CARRY_COST;
                    // Even more expensive to carry large objects
                    if (this.worldObjects[node.holding].size === "large")
                        edge.cost += CARRY_LARGE_COST;
                }

                edges.push(edge);
            }
            // Possible to pick up object?
            if (!node.holding && node.stacks[node.arm].length > 0) {
                var edge = new Edge<SearchState>();
                edge.from = node;
                var tempStacks = node.stacks.map((stack) => stack.slice());
                var hold = tempStacks[node.arm].pop();
                edge.to = new SearchState(
                    tempStacks,
                    hold,
                    node.arm);
                // Cost >= 1 that decreases with stack size => easier to pick up objects higher up
                // The stack can at most contain all objects.. duh
                edge.cost = pickUpCost(this.numObjects, node.stacks, node.arm);

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
                    // cost = base action cost + max pickup cost
                    edge.cost = 1 + MAX_PICKUP_COST; // stack size = 0

                    edges.push(edge);
                } else {
                    var topmostObject = node.stacks[node.arm][node.stacks[node.arm].length - 1];
                    var objectData = this.worldObjects[topmostObject];
                    var holdingData = this.worldObjects[node.holding];
                    var relation = objectData.form == "box" ? "inside" : "ontop";
                    if (Util.isValidRelation(
                        { form: holdingData.form, size: holdingData.size },
                        relation,
                        { form: objectData.form, size: objectData.size })) {
                        var edge = new Edge<SearchState>();
                        edge.from = node;
                        var tempStacks = node.stacks.map((stack) => stack.slice());
                        tempStacks[node.arm].push(node.holding);
                        edge.to = new SearchState(
                            tempStacks,
                            null,
                            node.arm);
                        // Cost >= 1 that decreases with increased stack size
                        // The stack can at most contain all objects.. duh
                        edge.cost = pickUpCost(this.numObjects, node.stacks, node.arm);

                        edges.push(edge);
                    }

                }

            }
            return edges;
        }

        // Never used, but demanded by interface.
        compareNodes(lhs : SearchState, rhs : SearchState) : number {
            return 0;
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
                    return literal.args[0] == node.holding;
                }

                var id = literal.args[0];
                if (id == node.holding) return false;

                var stack : number = Util.findStack(id, node.stacks);
                var entity = new Util.WorldObject(id, stack, node.stacks[stack].indexOf(id));
                var relation = literal.relation;
                var relativeTo = literal.args[1];
                var ids = entity.findRelated(node.stacks, relation);

                return Util.contains(ids, relativeTo);
            });
        });
    }

    function heuristics(interpretation : Interpreter.DNFFormula, numObjects : number) : (node : SearchState) => number {

        return node => {

            // Internal functions

            const closestTo = (from : number, a : number, b : number) : number =>
                Math.abs(a - from) < Math.abs(b - from) ? a : b;

            // Estimates the cost of moving the arm, ignores cost of carrying objects
            const estimateMoveCost = (stack1 : number, stack2 : number) : number => {
                var distanceToStack = Math.abs(stack1 - stack2);
                return MOVE_COST * distanceToStack;
            }

            // Estimates the cost of removing elements above a specific position
            const estimateRemoveAboveCost = (pos : Util.Position) : number => {
                var itemsOnTop = (node.stacks[pos.x].length - 1) - pos.y;
                // Drop somewhere else and go back. Assumes picking up and dropping costs 1.
                const COST_PER_ON_TOP = 1 + CARRY_COST + 1 + MOVE_COST;
                return itemsOnTop * COST_PER_ON_TOP + 1;
            }

            // Estimates the cost of moving an element from one position to another in the same stack
            const estimateMoveToSameStackCost = (pos1 : Util.Position, pos2 : Util.Position) => {
                var closestStack = closestTo(node.arm, pos1.x, pos2.x);
                // Need to at least move to the closest one and move it to the other
                // stack, as well as remove items ontop of one of them
                return estimateMoveCost(node.arm, closestStack) + estimateMoveCost(pos1.x, pos2.x) +
                       Math.min(estimateRemoveAboveCost(pos1) + estimateRemoveAboveCost(pos2));
            }

            // The interpretation contains a disjunction (list) of conjunctions (possible goal states).
            // We return the estimated cost of the cheapest conjunction (goal). We estimate the cost
            // of a conjunction by taking estimating the cost of performing the most expensive literal
            // (part), the sum of all parts may be an overestimate.

            return Math.min.apply(null, interpretation.map((conjunction) => {
                return Math.max.apply(null, conjunction.map((literal) => {

                    const leftRightHeuristic = (right : boolean) : number => {
                        var pos1 = Util.findStackAndPosition(literal.args[0], node.stacks);
                        var pos2 = Util.findStackAndPosition(literal.args[1], node.stacks);

                        // Give up if either is held or not in world
                        if (!pos1 || !pos2) {
                            return 0;
                        }

                        if (right) [pos1, pos2] = [pos2, pos1];

                        if (pos1.x < pos2.x) {
                            return 0;
                        }

                        // Find shortest distance needed needed to move
                        var distFromGoal = pos2.x - pos1.x + 1;
                        if (distFromGoal == 0) {
                            return 0;
                        }

                        var closestStack = closestTo(node.arm, pos1.x, pos2.x);
                        // Need to at least move to closest, move one closer to the other and having removed all on top of one of them
                        return estimateMoveCost(node.arm, closestStack) +
                            distFromGoal * MOVE_COST +
                            Math.min(estimateRemoveAboveCost(pos1) + estimateRemoveAboveCost(pos2));
                    }

                    const underAboveHeuristic = (above : boolean) : number => {
                        var pos1 = Util.findStackAndPosition(literal.args[0], node.stacks);
                        var pos2 = Util.findStackAndPosition(literal.args[1], node.stacks);

                        // Give up if either is held or not in world
                        if (!pos1 || !pos2) {
                            return 0;
                        }

                        if (above) [pos1, pos2] = [pos2, pos1];

                        if (pos1.x != pos2.x) {
                            return estimateMoveToSameStackCost(pos1, pos2);
                        }

                        if (pos1.y < pos2.y) {
                            // Goal fulfilled
                            return 0;
                        }
                        // Need to at least reach down to the lowest one
                        return estimateRemoveAboveCost(pos2);
                    }

                    const onTopInsideHeuristic = () : number => {
                        var pos1 = Util.findStackAndPosition(literal.args[0], node.stacks);
                        var pos2 = Util.findStackAndPosition(literal.args[1], node.stacks);

                        // Give up if either is held or not in world
                        if (!pos1 || !pos2) {
                            return 0;
                        }

                        if (pos1.x != pos2.x) {
                            return estimateMoveToSameStackCost(pos1, pos2);
                        } else {
                            if (pos1.y == pos2.y + 1) {
                                // Goal fulfilled
                                return 0;
                            } else if (pos1.y < pos2.y) {
                                // Can do smarter estimations here
                                return estimateRemoveAboveCost(pos2);
                            } else {
                                return estimateRemoveAboveCost(pos1);
                            }
                        }
                    }

                    switch (literal.relation) {
                    case "holding":
                        var pos = Util.findStackAndPosition(literal.args[0], node.stacks);
                        if (!pos) return 0;
                        var distanceToStack = Math.abs(pos.x - node.arm) + 1;
                        return distanceToStack * MOVE_COST + estimateRemoveAboveCost(pos);
                    case "leftof": // Distance that the an object has to be moved to be left of another object
                        return leftRightHeuristic(false);
                    case "rightof":
                        return leftRightHeuristic(true);
                    case "inside":
                        return onTopInsideHeuristic();
                    case "ontop":
                        return onTopInsideHeuristic();
                    case "under":
                        return underAboveHeuristic(false);
                    case "above":
                        return underAboveHeuristic(true);
                    case "beside":
                        var pos1 = Util.findStackAndPosition(literal.args[0], node.stacks);
                        var pos2 = Util.findStackAndPosition(literal.args[1], node.stacks);
                        if (!pos1 || !pos2) {
                            return 0;
                        }

                        // Find shortest distance needed for them to be between each other
                        var distFromBetween = Math.min(Math.abs(pos1.x - pos2.x - 1), Math.abs(pos1.x - pos2.x + 1));
                        if (distFromBetween == 0) {
                            return 0;
                        }

                        var closestStack = closestTo(node.arm, pos1.x, pos2.x);
                        // Need to at least move to closest, move one closer to the other and having removed all on top of one of them
                        return estimateMoveCost(node.arm, closestStack) + distFromBetween * MOVE_COST + Math.min(estimateRemoveAboveCost(pos1) + estimateRemoveAboveCost(pos2));
                    default: return 0;
                    }
                }));
            }));
        };
    }

    function convertPathToPlan(objects : { [s : string] : ObjectDefinition }, path : SearchResult<SearchState>) : string[] {

        var plan : string[] = [];
        var pickedUpAnything = false;

        // Go through the whole path, for each node look at the current one and the next one to find the difference
        for (var i : number = 0; i < path.path.length - 1; ++i) {
            var current = path.path[i];
            var next = path.path[i + 1];

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
                pickedUpAnything = true;
                var action = (i != path.path.length - 2) ? "Moving" : "Taking";
                var objDesc = "the " + Util.shortestDescription(next.holding, objects, current.stacks);
                plan.push(action + " " + objDesc);
                plan.push("p");
                continue;
            }

            // Check if arm dropped something
            if (!!current.holding && !next.holding) {
                if (!pickedUpAnything) {
                    var objDesc = "the " + Util.shortestDescription(current.holding, objects, current.stacks);
                    plan.push("Dropping " + objDesc);
                }
                pickedUpAnything = false;
                plan.push("d");
                continue;
            }
        }

        return plan;
    }

    /**
     * Produce a plan given an interpretation.
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

        // Create parameters for A* search
        var initialState = worldToSearchState(state);
        var graph = new SearchStateGraph(state);
        var goalFunc = goal(interpretation);
        var heuristicsFunc = heuristics(interpretation, graph.numObjects);
        var timeout = 60; // 1 minute should be enough for anyone :v

        // Call A* and retreive path
        var path = aStarSearch<SearchState>(graph, initialState, goalFunc, heuristicsFunc, timeout);

        if (!path) {
            throw new Error("No solution found");
        }

        // Convert path to plan
        return convertPathToPlan(state.objects, path);
    }

}
