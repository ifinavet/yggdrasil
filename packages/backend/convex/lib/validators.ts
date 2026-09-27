import { v } from "convex/values";

/** A validator for one of the values in a shared tuple, so the schema and the labels agree. */
export function oneOf<T extends string>(values: readonly [T, ...T[]]) {
	return v.union(...values.map((value) => v.literal(value)));
}
