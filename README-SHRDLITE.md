# Shrdlite Readme

## Interpreter.ts

## Util.ts

`Util.ts` contains a number of functions used throughout the rest of the program. It also contains the `WorldObject` class which describes in what stack an object is and what position in that stack it has.

## Planner.ts

Apart from the standard functionality of the planner (i.e. using A* to find a plan for the
interpretation found by the interpreter) our planner also has the following functionality:

### Extended Cost Function

One of the extensions we chose to implement was an extended cost function. Instead of the standard cost function where every action has the same cost, i.e. minimizes the number of actions made, our cost function minimizes the amount of work done. We have defined work in such a way that it requires more energy to carry objects than to just move and large objects are even "heavier". It is also more straining to pick up an object that is closer to the ground, i.e. it costs less to pick up the topmost object in a tall stack than picking up something from the floor. We chose to have a linear interpolation between the maximum and minimum costs for picking up objects.

### Action Description

When the planner constructs the actual plan from the path it also add descriptive messages to tell the user what it is doing. It utilizes the function `shortestDescription`, which takes the world state (current stack distribution), object descriptions and an object name (identifier) as arguments and returns the shortest unambigous description of the object.