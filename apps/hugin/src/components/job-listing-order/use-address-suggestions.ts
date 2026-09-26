"use client";

import { api } from "@workspace/backend/convex/api";
import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 100;

export function useAddressSuggestions(query: string, enabled: boolean): readonly string[] {
	const searchAddresses = useAction(api.jobListingOrders.addressSearch.searchAddresses);
	const [suggestions, setSuggestions] = useState<readonly string[]>([]);
	const latest = useRef(0);

	useEffect(() => {
		const request = ++latest.current;
		const trimmed = query.trim();
		if (!enabled || trimmed.length < MIN_QUERY_LENGTH || trimmed.length > MAX_QUERY_LENGTH) {
			setSuggestions([]);
			return;
		}

		const timer = window.setTimeout(async () => {
			try {
				const found = await searchAddresses({ query: trimmed });
				if (request === latest.current) setSuggestions(found);
			} catch {
				if (request === latest.current) setSuggestions([]);
			}
		}, DEBOUNCE_MS);

		return () => window.clearTimeout(timer);
	}, [query, enabled, searchAddresses]);

	return suggestions;
}
