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
    var startTime = new Date().getTime();

    class FrontierItem {
        constructor(
            public currNode : Node,
            public prevItem : FrontierItem,
            public cost : number
        ) { }

        // Order according to lowest cost + heuristic
        static compare: collections.ICompareFunction<FrontierItem> =
        (a, b) => b.cost + heuristics(b.currNode) - a.cost - heuristics(a.currNode);

        // Reconstruct a path to the current node
        path() : SearchResult<Node> {
            var result = new SearchResult<Node>();
            result.path = this.prevItem ? this.prevItem.path().path.concat([this.currNode]) : [this.currNode];
            result.cost = this.cost;
            return result;
        }
    }

    // Keep track of visited nodes and the frontier
    var visited  = new collections.Set<Node>();
    var frontier = new collections.PriorityQueue<FrontierItem>(FrontierItem.compare);
    frontier.enqueue(new FrontierItem(start, null, 0));

    // A* search
    while (!frontier.isEmpty()) {
        var item = frontier.dequeue();

        // Skip if the node has already been visited
        if (!visited.add(item.currNode)) { continue; }
        // We found the goal node, reconstruct the path there
        if (goal(item.currNode)) { return item.path(); }

        // Add nodes connected to outgoing edges to the frontier
        for (var edge of graph.outgoingEdges(item.currNode)) {
            if (!visited.contains(edge.to)) {
                frontier.enqueue(new FrontierItem(edge.to, item, item.cost + edge.cost));
            }
        }

        // Give up if search has taken too long
        var now = new Date().getTime();
        if (now - startTime > timeout * 1000) {
            break;
        }
    }
    // No path was found, return undefined
    return undefined;
}

