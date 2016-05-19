/**
 * Util module
 *
 * Provides utility functionality for dealing with object's and stacks in a world.
 */
module Util {
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
     * A class containing positional data about an object in a world.
     */
    export class WorldObject {
        /**
         * @param id The unique identifer of the object.
         * @param stack The index of the stack to which this object belongs.
         * @param pos This object's position in its stack.
         */
        constructor(
            public id: string,
            public stack: number,
            public pos: number
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
     * Check if list contains an element.
     */
    export function contains<T>(list : T[], element : T) : boolean {
        return list.indexOf(element) !== -1;
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

        var propertyCombinations = [["form"], ["color", "form"], ["size", "form"]];
        var objectDef = objects[objectKey];

        // Determine if a set of properties uniquely describes an object
        var isUnique = (propertySet : string[]) : boolean => {
            return stacks.every((stack) => {
                return stack.every((otherKey) => {
                    return objectKey == otherKey || !propertySet.every((prop) =>
                        (objectDef as any)[prop] == (objects[otherKey] as any)[prop]
                    );
                });
            });
        }
        var uniquePropertySets = propertyCombinations.filter((propertySet) => isUnique(propertySet));
        var selectedPropertySet = uniquePropertySets ? uniquePropertySets[0] : ["size", "color", "form"];
        return selectedPropertySet.reduce((prev, curr) => prev + " " + (objects[objectKey] as any)[curr], "");
    }
}
