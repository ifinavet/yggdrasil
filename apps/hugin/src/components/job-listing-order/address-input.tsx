"use client";

import { Command, CommandItem, CommandList } from "@workspace/ui/components/command";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent } from "@workspace/ui/components/popover";
import { Command as CommandPrimitive } from "cmdk";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { addressKeyTarget, movesSuggestionHighlight } from "@/lib/job-listing-order/address-keys";
import { useAddressSuggestions } from "./use-address-suggestions";

export function AddressInput({
	label,
	value,
	invalid,
	onChange,
	onBlur,
	onInputId,
}: Readonly<{
	label: string;
	value: string;
	invalid: boolean;
	onChange: (value: string) => void;
	onBlur: () => void;
	onInputId: (id: string | undefined) => void;
}>) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [typing, setTyping] = useState(false);
	const [navigated, setNavigated] = useState(false);
	const suggestions = useAddressSuggestions(value, typing);
	const open = typing && suggestions.length > 0;

	useEffect(() => onInputId(inputRef.current?.id), [onInputId]);

	const close = () => {
		setTyping(false);
		setNavigated(false);
	};

	const pick = (address: string) => {
		onChange(address);
		close();
	};

	const routeKey = (event: KeyboardEvent<HTMLInputElement>) => {
		if (addressKeyTarget(event, { open, navigated }) === "input") {
			event.stopPropagation();
			if (event.key === "Enter") close();
			return;
		}
		if (movesSuggestionHighlight(event)) setNavigated(true);
	};

	return (
		<Command shouldFilter={false} label={label} className="h-auto overflow-visible bg-transparent">
			<Popover open={open} onOpenChange={(next) => !next && close()}>
				<PopoverAnchor asChild>
					<CommandPrimitive.Input asChild value={value}>
						<Input
							ref={inputRef}
							autoComplete="street-address"
							aria-expanded={open}
							aria-invalid={invalid}
							onKeyDown={routeKey}
							onBlur={() => {
								close();
								onBlur();
							}}
							onChange={(event) => {
								onChange(event.target.value);
								setTyping(true);
								setNavigated(false);
							}}
						/>
					</CommandPrimitive.Input>
				</PopoverAnchor>
				<PopoverContent
					align="start"
					className="w-(--radix-popover-trigger-width) min-w-72 p-1"
					onOpenAutoFocus={(event) => event.preventDefault()}
					onInteractOutside={(event) => {
						if (event.target instanceof Node && inputRef.current?.contains(event.target)) {
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
