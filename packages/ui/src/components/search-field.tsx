"use client";

import { currentPlatform, searchShortcutKeys } from "@workspace/ui/lib/search-shortcut";
import { cn } from "@workspace/ui/lib/utils";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export function SearchField({
	value,
	onChange,
	placeholder,
	className,
}: Readonly<{
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}>) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [shortcutKeys, setShortcutKeys] = useState(() => searchShortcutKeys("mac"));

	useEffect(() => {
		setShortcutKeys(searchShortcutKeys(currentPlatform()));
	}, []);

	useHotkeys(
		"mod+k",
		() => {
			const input = inputRef.current;
			if (document.activeElement === input) input?.blur();
			else input?.focus();
		},
		{ enableOnFormTags: true, preventDefault: true },
	);

	return (
		<label
			className={cn(
				"flex h-9 w-full items-center gap-2 rounded-md border border-input px-3 text-muted-foreground shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
				className,
			)}
		>
			<Search className="size-4 flex-none" />
			<input
				ref={inputRef}
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") event.currentTarget.blur();
				}}
				placeholder={placeholder}
				aria-label={placeholder}
				className="min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
			/>
			<span className="ml-auto inline-flex gap-0.5">
				{shortcutKeys.map((key) => (
					<kbd
						key={key}
						className="rounded-[4px] border bg-muted px-[5px] font-medium font-sans text-[11px] text-muted-foreground leading-[18px]"
					>
						{key}
					</kbd>
				))}
			</span>
		</label>
	);
}
