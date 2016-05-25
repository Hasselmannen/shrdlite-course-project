# Shrdlite Readme

## Interpreter.ts

## Util.ts

## Planner.ts

### Extended cost function

One of the extensions we chose to implement was an extended cost function. Instead of the standard cost function where every action has the same cost, i.e. minimizes the number of actions made, our cost function minimizes the amount of work done. We have defined work in such a way that it requires more energy to carry objects than to just move and large objects are even "heavier". It is also more straining to pick up an object that is closer to the ground, i.e. it costs less to pick up the topmost object in a tall stack than picking up something from the floor. We chose to have a linear interpolation between the maximum and minimum costs for picking up objects.