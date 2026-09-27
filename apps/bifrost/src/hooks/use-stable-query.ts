"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

export function latestResult<T>(stored: T | undefined, next: T | undefined) {
	if (next === undefined) return stored;
	return next;
}

export const useStableQuery: typeof useQuery = (query, ...args) => {
	const result = useQuery(query, ...args);
	const [stored, setStored] = useState(result);
	if (result !== undefined && result !== stored) setStored(result);
	return latestResult(stored, result);
};
