"use client";

import { useAsyncDebouncer } from "@tanstack/react-pacer";
import { api } from "@workspace/backend/convex/api";
import { addressQuerySchema } from "@workspace/shared/job-listing-orders";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 300;

type Suggestions = Readonly<{ query: string; addresses: readonly string[] }>;

const NO_SUGGESTIONS: Suggestions = { query: "", addresses: [] };

export function useAddressSuggestions(value: string, enabled: boolean): readonly string[] {
	const searchAddresses = useAction(api.jobListingOrders.addressSearch.searchAddresses);
	const [sessionId] = useState(() => crypto.randomUUID());
	const [suggestions, setSuggestions] = useState<Suggestions>(NO_SUGGESTIONS);
	const debouncer = useAsyncDebouncer(
		async (query: string): Promise<Suggestions> => ({
			query,
			addresses: await searchAddresses({ query, sessionId }),
		}),
		{
			wait: DEBOUNCE_MS,
			onSuccess: setSuggestions,
			onError: (_error, [query]) => setSuggestions({ query, addresses: [] }),
		},
	);

	const parsed = addressQuerySchema.safeParse(value);
	const query = enabled && parsed.success ? parsed.data : null;

	useEffect(() => {
		if (query === null) debouncer.cancel();
		else debouncer.maybeExecute(query);
	}, [debouncer, query]);

	return query !== null && suggestions.query === query ? suggestions.addresses : [];
}
