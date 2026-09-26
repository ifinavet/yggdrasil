"use client";

import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { type KeyboardEvent, useState } from "react";
import { moveActiveSuggestion } from "@/lib/job-listing-order/address-suggestions";
import { useAddressSuggestions } from "./use-address-suggestions";

export function AddressInput({
	id,
	label,
	value,
	invalid,
	onChange,
	onBlur,
}: Readonly<{
	id: string;
	label: string;
	value: string;
	invalid: boolean;
	onChange: (value: string) => void;
	onBlur: () => void;
}>) {
	const listId = `${id}-suggestions`;
	const [typing, setTyping] = useState(false);
	const suggestions = useAddressSuggestions(value, typing);
	const [highlight, setHighlight] = useState({ list: suggestions, index: -1 });
	const active = highlight.list === suggestions ? highlight.index : -1;
	const open = typing && suggestions.length > 0;

	const pick = (address: string) => {
		onChange(address);
		setTyping(false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!open) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setHighlight({
				list: suggestions,
				index: moveActiveSuggestion(active, step, suggestions.length),
			});
		} else if (event.key === "Enter" && active >= 0) {
			event.preventDefault();
			pick(suggestions[active] ?? value);
		} else if (event.key === "Escape") {
			setTyping(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={(next) => !next && setTyping(false)}>
			<PopoverAnchor asChild>
				<Input
					id={id}
					role="combobox"
					autoComplete="street-address"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={listId}
					aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
					aria-invalid={invalid}
					value={value}
					onKeyDown={onKeyDown}
					onBlur={() => {
						setTyping(false);
						onBlur();
					}}
					onChange={(event) => {
						onChange(event.target.value);
						setTyping(true);
					}}
				/>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				className="w-(--radix-popover-trigger-width) min-w-72 p-1"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					if (event.target instanceof Node && document.getElementById(id)?.contains(event.target)) {
						event.preventDefault();
					}
				}}
			>
				<div id={listId} role="listbox" aria-label={label}>
					{suggestions.map((address, index) => (
						<div
							key={address}
							id={`${listId}-${index}`}
							role="option"
							aria-selected={index === active}
							tabIndex={-1}
							className={cn(
								"cursor-pointer rounded-sm px-2 py-1.5 text-sm",
								index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
							)}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => pick(address)}
							onKeyDown={(event) => event.key === "Enter" && pick(address)}
						>
							{address}
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
