# Shrdlite Readme

## `Interpreter.ts`

For the interpreter we chose to extend the project with support for the `all` quantifier. Apart from that, there is no functionality beyond that of the standard shrdlite project. The code may, however not be the same as the one submitted earlier.

### The `all` Quantifier

The `all` quantifier can be applied to a statement in three ways:

1. To specify that `all <something>` should have a relation with one or more objects.
2. To specify that one or more objects should have a relation with `all <something>`.
3. To specify that `all <something>` are related to `all <something>`.

The difference between the `all` quantifier and the `any` quantifier is that any object that has a relation with `all <something>` makes up a conjunction, where all of these relations are present. This is done in the `toCNF` function, whose result is then passed to the `CNFtoDNF` function where the `DNFFormula` is created. In the third of the cases, another pass is made where everything is flattened into a single conjunction.

Worth noting is that statements such as `put a ball beside all boxes` is not only interpreted as "put one ball so that it is beside all boxes", but also as "make sure all the boxes have at least one ball beside them", which might not be very intuitive in every case.

Furthermore, `all objects` really mean all, so for instance, `put the large green box beside all objects` will be interpreted, but not in a way that is satisfiable; it would be interpreted as trying to put the specified box beside itself.

## `Util.ts`

`Util.ts` contains a number of functions used throughout the rest of the program. It also contains the `WorldObject` class which describes in what stack an object is and what position in that stack it has.

## `Planner.ts`

Apart from the standard functionality of the planner (i.e. using A* to find a plan for the interpretation found by the interpreter) our planner also has the following functionality:

### Extended Cost Function

One of the extensions we chose to implement was an extended cost function. Instead of the standard cost function where every action has the same cost, i.e. minimizes the number of actions made, our cost function minimizes the amount of work done. We have defined work in such a way that it requires more energy to carry objects than to just move and large objects are even "heavier". It is also more straining to pick up an object that is closer to the ground, i.e. it costs less to pick up the topmost object in a tall stack than picking up something from the floor. We chose to have a linear interpolation between the maximum and minimum costs for picking up objects.

### Action Description

When the planner constructs the actual plan from the path it also add descriptive messages to tell the user what it is doing. It utilizes the function `shortestDescription`, which takes the world state (current stack distribution), object descriptions and an object name (identifier) as arguments and returns the shortest unambiguous (if there is one) description of the object.

### Heuristic

We have implemented quite an advanced heuristic, we are not sure if it is on extension level though. Basically we return the cost of the cheapest goal, and we estimate the cost of each goal by the most expensive part in reaching that goal. The reason for this is that the cost for reaching a goal can't possibly be cheaper than its most expensive part, but the cost of reaching other parts could change after achieving some of them. Thus we can't just take the sum of the parts if we want an admissible heuristic. When estimating the cost of a part we try to use as much information as given only the starting state of the world.

## `Graph.ts`

`Graph.ts` has no new functionality compared to the standard A* search. The code may not be identical to the one handed in earlier, but we've made no extensions to this part of the shrdlite project. Overall it should be a fairly straightforward implementation of A* search.
