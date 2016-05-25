/**
 * Util module
 *
 * Provides utility functionality for dealing with object's and stacks in a world.
 */
module Util {

    /**
     * A class representing a position in the world.
     * x is the index of the stack
     * y is the distance to the floor, so if a stack only have one element its value of y is 0
     */
    export class Position {
        constructor(public x : number, public y : number) { }
    }

    /**
     * Finds the index in the stack to which the given id belongs in the given
     * list of stacks.
     *
     * @param id The id of the object to be located.
     * @param stacks The list of the world's stacks.
     * @returns The index of the stack to which the id belongs, or -1 if it could not be located.
     */
    export function findStack(id : string, stacks : string[][]) : number {
        for (var i = stacks.length - 1; i >= 0; i--) {
            if (Util.contains(stacks[i], id)) return i;
        }
        return -1;
    }

    /**
     * Finds the stack index and position of the object with a gived id.
     *
     * @param id The id of the object to be located.
     * @param stacks The list of the world's stacks.
     * @returns The position, or undefined if not found.
     */
    export function findStackAndPosition(id : string, stacks : string[][]) : Position {
        for (var x = 0; x < stacks.length; x++) {
            for (var y = 0; y < stacks[x].length; y++) {
                if (stacks[x][y] == id) {
                    return new Position(x, y);
                }
            }
        }
        return undefined;
    }

    /**
     * A class containing positional data about an object in a world.
     */
    export class WorldObject {
        /**
         * @param id The unique identifer of the object.
         * @param stack The index of the stack to which this object belongs.
         * @param pos This object's position in its stack.
         */
        constructor(
            public id : string,
            public stack : number,
            public pos : number
        ) { }


        /**
         * Given a list of stacks and a positional relation, returns the
         * identifiers of objects which are positioned so that the relation
         * is satisfied.
         *
         * @param stacks The stacks of the world.
         * @param relation The positional relation of this object to other objects in the world.
         * @returns A list of identifiers that satisfy the relation.
         */
        findRelated(stacks : string[][], relation : string) : string[] {
            switch (relation) {
            case "leftof":
                return this.stack < stacks.length - 1 ? [].concat.apply([], stacks.slice(this.stack + 1)) : [];
            case "rightof":
                return this.stack > 0 ? [].concat.apply([], stacks.slice(0, this.stack)) : [];
            case "inside":
                return [stacks[this.stack][this.pos - 1]];
            case "ontop":
                return this.pos > 0 ? [stacks[this.stack][this.pos - 1]] : ["floor"];
            case "under":
                return stacks[this.stack].slice(
                    stacks[this.stack].indexOf(this.id) + 1);
            case "beside":
                return (this.stack > 0 ? stacks[this.stack - 1] : []).concat(
                    this.stack < stacks.length - 1 ? stacks[this.stack + 1] : []);
            case "above":
                return ["floor"].concat(
                    stacks[this.stack].slice(
                        0,
                        stacks[this.stack].indexOf(this.id)
                    ));
            default:
                throw new Error("Not implemented: " + relation);
            }
        }
    }

    /**
     * Checks whether or not an object can have a relation with another object.
     *
     *@param lhs The object that has a relation with another object.
     *@param relation The of lhs in regards to rhs.
     *@param rhs The object to which lhs is related.
     *@returns True if the relation is possible for the two objects, false otherwise.
     */
    export function isValidRelation(
        lhs : { form? : string, size? : string },
        relation : string,
        rhs : { form? : string, size? : string }
    ) : boolean {
        if (rhs.form == "floor" && !(relation == "ontop" || relation == "above")) throw new Error("Nothing can be " + relation + " the floor");
        if (lhs.form == "floor" && relation != "under") throw new Error("The floor cannot be " + relation + " anything");
        if (relation == "ontop") {
            if (rhs.form == "box" || rhs.form == "ball") return false;
            if (lhs.form == "ball" && rhs.form != "floor") return false;
            if (lhs.size == "large" && rhs.size == "small") return false;
            if (lhs.form == "box" && rhs.size == "small" && (rhs.form == "brick" || rhs.form == "pyramid")) return false;
            if (lhs.form == "box" && lhs.size == "large" && rhs.form == "pyramid") return false;
        } else if (relation == "inside") {
            if (rhs.form != "box") return false;
            if (rhs.size == lhs.size && (lhs.form != "ball" && lhs.form != "brick" && lhs.form != "table")) return false;
            if (rhs.size == "small" && lhs.size == "large") return false;
        } else if (relation == "above") {
            if (rhs.form == "ball") return false;
            if (lhs.size == "large" && rhs.size == "small") return false;
        } else if (relation == "under") {
            return isValidRelation(rhs, "above", lhs);
        }
        return true;
    }

    /**
     * Returns the shortest unique description of an object in the world, using only
     * the object properties, if possible.
     *
     * Form is always included, but color is preferred over size. The result only
     * contains both if needed. If there is no unique description, all properties are
     * used.
     * 
     * @param objectKey The key of the item to find a description for.
     * @param objects A mapping from object keys to definitions.
     * @param stacks The stacks of the world.
     */
    export function shortestDescription(
        objectKey : string,
        objects : { [index : string] : ObjectDefinition },
        stacks : string[][]) : string {
        const propertyCombinations = [["form"], ["color", "form"], ["size", "form"]];
        var objectDef = objects[objectKey];

        // Determine if a set of properties uniquely describes an object
        var isUnique = (propertySet : string[]) : boolean =>
            stacks.every(stack =>
                stack.every(otherKey =>
                    objectKey == otherKey ||
                    !propertySet.every((prop) =>
                        (objectDef as any)[prop] == (objects[otherKey] as any)[prop]
                    )
                )
            );
        // Find the first property set that contains enough information
        var selectedPropertySet = find(propertyCombinations, isUnique, ["size", "color", "form"]);

        // Fetch the values of the properties and combine to a single string
        var values = selectedPropertySet.map(property => (objects[objectKey] as any)[property]);
        return values.join(" ");
    }

    /**
     * Check if list contains a given element.
     * 
     * @param list The list to look in.
     * @param element The element to look for.
     */
    export function contains<T>(list : T[], element : T) : boolean {
        return list.indexOf(element) !== -1;
    }

    /**
     * Finds the first element in a list where a condition holds, or a given
     * fallback value if not found.
     * 
     * @param list The list to look in.
     * @param condition The boolean predicate to check for.
     * @param notFoundValue The value returned if the condition does not hold for any element.
     */
    export function find<T>(list : T[], condition : (x : T) => boolean, notFoundValue : T) : T {
        for (var element of list) {
            if (condition(element)) {
                return element;
            }
        }
        return notFoundValue;
    }

}
