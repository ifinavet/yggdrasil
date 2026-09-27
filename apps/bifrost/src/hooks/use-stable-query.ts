"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { useState } from "react";

type Keyed<T> = { key: string; result: T | undefined };

export function latestResult<T>(stored: Keyed<T>, next: Keyed<T>) {
	if (next.result !== undefined) return next.result;
	if (stored.key !== next.key) return undefined;
	return stored.result;
}

export function useStableQuery<Query extends FunctionReference<"query">>(
	query: Query,
	args: FunctionArgs<Query>,
	key = "",
): FunctionReturnType<Query> | undefined {
	const result = useQuery(query, args);
	const [stored, setStored] = useState<Keyed<FunctionReturnType<Query>>>({ key, result });
	if (result !== undefined && (result !== stored.result || key !== stored.key)) {
		setStored({ key, result });
	}
	return latestResult(stored, { key, result });
}
