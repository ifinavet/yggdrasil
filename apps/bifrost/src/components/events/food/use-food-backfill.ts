"use client";

import { useConvexAuth } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

export function useFoodBackfill() {
	const { isAuthenticated } = useConvexAuth();
	const pending = useQuery(api.events.food.backfillPending, isAuthenticated ? {} : "skip");
	const setup = useMutation(api.events.food.setupBackfill);

	useEffect(() => {
		if (pending) void setup({});
	}, [pending, setup]);
}
