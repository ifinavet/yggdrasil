"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";

/** Picks one internal member, e.g. an organizer or a board member. */
export default function InternalMemberSelect({
	labelId,
	value,
	onChange,
	invalid,
	exclude,
	clearLabel,
	onClear,
	disabled,
	className,
}: Readonly<{
	labelId: string;
	value: string | null;
	onChange: (userId: Id<"users">) => void;
	invalid?: boolean;
	/** Members already picked elsewhere, e.g. in another role, left out of the list. */
	exclude?: ReadonlySet<string>;
	/** Adds a choice that clears the pick, calling `onClear`. */
	clearLabel?: string;
	onClear?: () => void;
	disabled?: boolean;
	className?: string;
}>) {
	const internalMembers = useQuery(api.users.organization.queries.getAll);

	return (
		<SearchSelect
			aria-labelledby={labelId}
			aria-invalid={invalid}
			className={cn("w-full sm:w-[200px]", className)}
			items={internalMembers
				?.filter((member) => !exclude?.has(member.userId))
				.map((member) => ({ id: member.userId, label: member.fullName }))}
			value={value}
			onChange={(userId) => {
				if (userId) onChange(userId as Id<"users">);
				else onClear?.();
			}}
			clearLabel={clearLabel}
			disabled={disabled}
			placeholder="Velg et medlem..."
			searchPlaceholder="Søk etter en ansvarlig..."
			emptyText="Fant ingen ansvarlige(er)."
		/>
	);
}
