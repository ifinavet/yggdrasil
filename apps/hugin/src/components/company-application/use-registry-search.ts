"use client";

import { api } from "@workspace/backend/convex/api";
import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import type { RegistryHit } from "@/lib/company-application";
import { companyErrorMessage } from "@/lib/company-error-message";

const DEBOUNCE_MS = 300;
export const MIN_QUERY_LENGTH = 2;

export type SearchState =
	| { status: "idle" }
	| { status: "searching" }
	| { status: "done"; hits: RegistryHit[] }
	| { status: "error"; message: string };

export function useRegistrySearch(query: string): { search: SearchState; retry: () => void } {
	const searchCompanies = useAction(api.semesterPlanning.registry.actions.searchCompanies);
	const [search, setSearch] = useState<SearchState>({ status: "idle" });
	const [attempt, setAttempt] = useState(0);
	const latest = useRef(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: attempt re-runs the same search on «Prøv igjen».
	useEffect(() => {
		const request = ++latest.current;
		if (query.length < MIN_QUERY_LENGTH) {
			setSearch({ status: "idle" });
			return;
		}

		setSearch({ status: "searching" });
		const timer = window.setTimeout(async () => {
			try {
				const hits = await searchCompanies({ query });
				if (request === latest.current) setSearch({ status: "done", hits });
			} catch (error) {
				if (request === latest.current) {
					setSearch({ status: "error", message: companyErrorMessage(error) });
				}
			}
		}, DEBOUNCE_MS);

		return () => window.clearTimeout(timer);
	}, [query, searchCompanies, attempt]);

	return { search, retry: () => setAttempt((count) => count + 1) };
}
