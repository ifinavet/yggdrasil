"use client";

import { Command, CommandItem, CommandList } from "@workspace/ui/components/command";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent } from "@workspace/ui/components/popover";
import { Command as CommandPrimitive } from "cmdk";
import { type KeyboardEvent, useState } from "react";
import { useAddressSuggestions } from "./use-address-suggestions";

const TEXT_CARET_KEYS = new Set(["Home", "End"]);

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
	const [typing, setTyping] = useState(false);
	const suggestions = useAddressSuggestions(value, typing);
	const open = typing && suggestions.length > 0;

	const pick = (address: string) => {
		onChange(address);
		setTyping(false);
	};

	const keepKeyInInput = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!open || TEXT_CARET_KEYS.has(event.key)) event.stopPropagation();
	};

	return (
		<Command shouldFilter={false} label={label} className="h-auto overflow-visible bg-transparent">
			<Popover open={open} onOpenChange={(next) => !next && setTyping(false)}>
				<PopoverAnchor asChild>
					<CommandPrimitive.Input asChild value={value}>
						<Input
							id={id}
							autoComplete="street-address"
							aria-expanded={open}
							aria-invalid={invalid}
							onKeyDown={keepKeyInInput}
							onBlur={() => {
								setTyping(false);
								onBlur();
							}}
							onChange={(event) => {
								onChange(event.target.value);
								setTyping(true);
							}}
						/>
					</CommandPrimitive.Input>
				</PopoverAnchor>
				<PopoverContent
					align="start"
					className="w-(--radix-popover-trigger-width) min-w-72 p-1"
					onOpenAutoFocus={(event) => event.preventDefault()}
					onInteractOutside={(event) => {
						if (
							event.target instanceof Node &&
							document.getElementById(id)?.contains(event.target)
						) {
							event.preventDefault();
						}
					}}
				>
					<CommandList>
						{suggestions.map((address) => (
							<CommandItem
								key={address}
								value={address}
								onMouseDown={(event) => event.preventDefault()}
								onSelect={() => pick(address)}
							>
								{address}
							</CommandItem>
						))}
					</CommandList>
				</PopoverContent>
			</Popover>
		</Command>
	);
}
