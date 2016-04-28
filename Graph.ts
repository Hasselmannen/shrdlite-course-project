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

    // Class for building path
	  class NodeData {
      constructor(
        public previous: NodeData,
        public node: Node,
        public cost: number
      ) { }

      toResult(): SearchResult<Node> {
        var result = new SearchResult<Node>();
        result.cost = this.cost;
        var path: Node[] = [];
        var current: NodeData = this;
        while (current.previous) {
          path.push(current.node);
          current = current.previous;
        }
        result.path = path.reverse();

        return result;
      }

    }

      // Comparator for ordering the priority queue
    const comparator : collections.ICompareFunction<NodeData> =
      (a, b) => ((b.cost + heuristics(b.node)) - (a.cost + heuristics(a.node)));


    var visited = new collections.Set<Node>();
    var frontier = new collections.PriorityQueue<NodeData>(comparator);
    var startTime = Date.now();
    frontier.enqueue(new NodeData(undefined, start, 0));

    while (!frontier.isEmpty()) {

      // Timeout check -> abort if time exceeds timeout
      var elapsedTimeMs = Date.now() - startTime;
      if (elapsedTimeMs > timeout * 1000) { return undefined; }

      var current: NodeData = frontier.dequeue();

      // Make sure not already visited
      if (!visited.add(current.node)) { continue; }
      // Check if the goal is found
      if (goal(current.node)) { return current.toResult(); }

      // Add neighbours to frontier
      for (var edge of graph.outgoingEdges(current.node)) {
        //if (!visited.contains(edge.to)) {
          frontier.enqueue(
            new NodeData(current, edge.to, current.cost + edge.cost)
          );
        //}
      }

    }
    // No path found
    return undefined;
}



