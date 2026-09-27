"use client";

import { Button } from "@workspace/ui/components/button";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import {
	createLatestGate,
	filterSearchItems,
	type SearchSelectItem,
} from "@workspace/ui/lib/search-select";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type { SearchSelectItem } from "@workspace/ui/lib/search-select";

const DEBOUNCE_MS = 300;

type SearchState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "done"; items: readonly SearchSelectItem[] }
	| { status: "error" };

type Source =
	| {
			/** Every choice, filtered here as the user types. `undefined` while it loads. */
			items: readonly SearchSelectItem[] | undefined;
			search?: never;
			minQueryLength?: never;
	  }
	| {
			/** Looks up choices for a query, debounced; only the newest query's answer is shown. */
			search: (query: string) => Promise<readonly SearchSelectItem[]>;
			/** Shorter queries are not searched. Defaults to 1. */
			minQueryLength?: number;
			items?: never;
	  };

type Selection =
	| {
			multiple?: false;
			value: string | null | undefined;
			onChange: (id: string | null, item: SearchSelectItem | null) => void;
			max?: never;
	  }
	| {
			multiple: true;
			value: readonly string[];
			onChange: (ids: string[]) => void;
			/** No more than this many can be picked; the rest of the list is disabled. */
			max?: number;
	  };

export type SearchSelectProps = Source &
	Selection & {
		id?: string;
		"aria-labelledby"?: string;
		"aria-describedby"?: string;
		"aria-invalid"?: boolean;
		/** Trigger text when nothing is picked. */
		placeholder?: string;
		searchPlaceholder?: string;
		emptyText?: string;
		loadingText?: string;
		errorText?: string;
		/** Adds a choice that clears the selection, shown while something is picked. */
		clearLabel?: string;
		/** Trigger text for the picked value, when the caller knows it better than the list does. */
		valueLabel?: string;
		disabled?: boolean;
		/** Classes for the trigger button, e.g. its width. */
		className?: string;
	};

/** Runs `search` for the query after a pause in typing, ignoring answers to older queries. */
function useDebouncedSearch(
	search: ((query: string) => Promise<readonly SearchSelectItem[]>) | undefined,
	query: string,
	minQueryLength: number,
): SearchState {
	const [state, setState] = useState<SearchState>({ status: "idle" });
	const [nextRequest] = useState(createLatestGate);
	// Kept in a ref so a new function each render does not restart the search.
	const searchRef = useRef(search);
	useEffect(() => {
		searchRef.current = search;
	});
	const enabled = search !== undefined;

	useEffect(() => {
		// Counted before the length check, so an answer for a longer query still on its way is ignored.
		const isLatest = nextRequest();
		const trimmed = query.trim();
		if (!enabled || trimmed.length < minQueryLength) {
			setState({ status: "idle" });
			return;
		}

		setState({ status: "loading" });
		const timer = setTimeout(() => {
			searchRef.current?.(trimmed).then(
				(items) => {
					if (isLatest()) setState({ status: "done", items });
				},
				() => {
					if (isLatest()) setState({ status: "error" });
				},
			);
		}, DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query, enabled, minQueryLength, nextRequest]);

	return state;
}

function statusText(
	state: SearchState,
	shownCount: number,
	texts: { loadingText: string; errorText: string; emptyText: string },
): string | null {
	if (state.status === "loading") return texts.loadingText;
	if (state.status === "error") return texts.errorText;
	if (state.status === "done" && shownCount === 0) return texts.emptyText;
	return null;
}

/**
 * A button that opens a searchable list, for picking one or several items. Give it a static list
 * to filter as the user types, or a `search` function for lookups on a server.
 */
export function SearchSelect(props: Readonly<SearchSelectProps>) {
	const {
		id,
		placeholder = "Velg...",
		searchPlaceholder = "Søk...",
		emptyText = "Fant ingen treff.",
		loadingText = "Laster...",
		errorText = "Søket feilet. Prøv igjen.",
		clearLabel,
		valueLabel,
		disabled,
		className,
	} = props;
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const searched = useDebouncedSearch(props.search, query, props.minQueryLength ?? 1);

	let state: SearchState = searched;
	if (!props.search) {
		state = props.items ? { status: "done", items: props.items } : { status: "loading" };
	}
	const known = state.status === "done" ? state.items : [];
	const shown = props.search ? known : filterSearchItems(known, query);

	const selectedIds: readonly string[] = props.multiple ? props.value : [props.value ?? ""];
	const isSelected = (itemId: string) => selectedIds.includes(itemId);
	const hasSelection = selectedIds.some(Boolean);
	const isFull = props.multiple && props.max !== undefined && props.value.length >= props.max;
	const triggerText =
		valueLabel ??
		(known
			.filter((item) => isSelected(item.id))
			.map((item) => item.label)
			.join(", ") ||
			null);

	const changeOpen = (next: boolean) => {
		setOpen(next);
		if (!next) setQuery("");
	};

	const pick = (item: SearchSelectItem) => {
		if (props.multiple) {
			props.onChange(
				isSelected(item.id)
					? props.value.filter((selectedId) => selectedId !== item.id)
					: [...props.value, item.id],
			);
			return;
		}
		if (item.id !== props.value) props.onChange(item.id, item);
		changeOpen(false);
	};

	const clear = () => {
		if (props.multiple) props.onChange([]);
		else props.onChange(null, null);
		changeOpen(false);
	};

	const message = statusText(state, shown.length, { loadingText, errorText, emptyText });

	return (
		<Popover open={open} onOpenChange={changeOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-labelledby={props["aria-labelledby"]}
					aria-describedby={props["aria-describedby"]}
					aria-invalid={props["aria-invalid"]}
					disabled={disabled}
					className={cn("justify-between font-normal", className)}
				>
					<span className={cn("truncate", !triggerText && "text-muted-foreground")}>
						{triggerText ?? placeholder}
					</span>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) min-w-[200px] p-0" align="start">
				<Command shouldFilter={false} loop label={searchPlaceholder}>
					<CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
					<CommandList>
						{message && (
							<p role="status" className="py-6 text-center text-muted-foreground text-sm">
								{message}
							</p>
						)}
						<CommandGroup>
							{clearLabel && hasSelection && (
								<CommandItem
									value="__clear__"
									onSelect={clear}
									className="text-muted-foreground"
								>
									<span className="size-4" />
									{clearLabel}
								</CommandItem>
							)}
							{shown.map((item) => (
								<CommandItem
									key={item.id}
									value={item.id}
									disabled={
										item.disabledReason !== undefined || (isFull && !isSelected(item.id))
									}
									onSelect={() => pick(item)}
								>
									<Check
										className={cn("size-4", isSelected(item.id) ? "opacity-100" : "opacity-0")}
									/>
									<span className="min-w-0 flex-1">
										<span className="block truncate">{item.label}</span>
										{item.description && (
											<span className="block truncate text-muted-foreground text-xs">
												{item.description}
											</span>
										)}
									</span>
									{item.disabledReason && (
										<span className="ml-auto text-muted-foreground text-xs">
											{item.disabledReason}
										</span>
									)}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
