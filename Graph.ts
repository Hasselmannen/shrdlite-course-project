///<reference path="lib/collections.ts"/>
///<reference path="lib/node.d.ts"/>

/** Graph module
*
*  Types for generic A\* implementation.
*
*  *NB.* The only part of this module
*  that you should change is the `aStarSearch` function. Everything
*  else should be used as-is.
*/

/** An edge in a graph. */
class Edge<Node> {
    from : Node;
    to   : Node;
    cost : number;
}

/** A directed graph. */
interface Graph<Node> {
    /** Computes the edges that leave from a node. */
    outgoingEdges(node : Node) : Edge<Node>[];
    /** A function that compares nodes. */
    compareNodes : collections.ICompareFunction<Node>;
}

/** Type that reports the result of a search. */
class SearchResult<Node> {
    /** The path (sequence of Nodes) found by the search algorithm. */
    path : Node[];
    /** The total cost of the path. */
    cost : number;
}

/**
* A\* search implementation, parameterised by a `Node` type. The code
* here is just a template; you should rewrite this function
* entirely. In this template, the code produces a dummy search result
* which just picks the first possible neighbour.
*
* Note that you should not change the API (type) of this function,
* only its body.
* @param graph The graph on which to perform A\* search.
* @param start The initial node.
* @param goal A function that returns true when given a goal node. Used to determine if the algorithm has reached the goal.
* @param heuristics The heuristic function. Used to estimate the cost of reaching the goal from a given Node.
* @param timeout Maximum time (in seconds) to spend performing A\* search.
* @returns A search result, which contains the path from `start` to a node satisfying `goal` and the cost of this path.
*/
function aStarSearch<Node> (
    graph : Graph<Node>,
    start : Node,
    goal : (n:Node) => boolean,
    heuristics : (n:Node) => number,
    timeout : number
) : SearchResult<Node> {

	var startTimeMs : number = Date.now();
	var timeoutMs : number = timeout * 1000;

	// Element to store in frontier
	class FrontierNode {
		node : Node; // The node
		previous : FrontierNode; // The previous node
		cost : number; // The cost from start to the node
		frontierValue : number; // Cost + heuristic
	}

	// Sort function for frontier
	var compareFunc : (lhs : FrontierNode, rhs : FrontierNode) => number = function(lhs, rhs) {
		return rhs.frontierValue - lhs.frontierValue;
	}

	// Create the frontier and add the start element
	var frontier = new collections.PriorityQueue<FrontierNode>(compareFunc);
	frontier.add({ node: start, previous: null, cost: 0, frontierValue: heuristics(start) });

	var last : FrontierNode = null;
	var visited = new collections.Set<Node>();

	// The search itself
	while (true) {

		// Check if timeout
		var timeSinceStartMs = Date.now() - startTimeMs;
		if (timeSinceStartMs > timeoutMs) {
			// Time is up, we failed.
			return undefined;
		}

		// Get current node
		if (frontier.isEmpty()) {
			break;
		}
		var current: FrontierNode = frontier.dequeue();

		// Check if node is already visisted
		if (visited.contains(current.node)) {
			continue;
		}

		// Add current node to visited
		visited.add(current.node);

		// Check if goal is reached
		if (goal(current.node)) {
			last = current;
			break;
		}

		// Add nodes from outgoing edges to frontier
		var outgoing: Edge<Node>[] = graph.outgoingEdges(current.node);
		for (var j: number = 0; j < outgoing.length; ++j) {
			if (visited.contains(outgoing[j].to)) continue;
			var fn = new FrontierNode();
			fn.node = outgoing[j].to;
			fn.previous = current;
			fn.cost = current.cost + outgoing[j].cost;
			fn.frontierValue = fn.cost + heuristics(outgoing[j].to);
			frontier.add(fn);
		}
	}

	// Check if we found something
	if (last == null) {
		return undefined; // Aw :(
	}

	// Create result and set its cost
	var result = new SearchResult<Node>();
	result.cost = last.cost;
	result.path = [];

	// Backtrack from last node and recreate path
	while (last != null) {
		result.path.push(last.node);
		last = last.previous;
	}

	// Reverse array so start comes first
	result.path.reverse();

	return result;
}


