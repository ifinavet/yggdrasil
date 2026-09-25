"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useQuery } from "convex/react";

/** Picks one internal member, e.g. an organizer or a board member. */
export default function InternalMemberSelect({
	labelId,
	value,
	onChange,
	invalid,
}: Readonly<{
	labelId: string;
	value: string | null;
	onChange: (userId: Id<"users">) => void;
	invalid?: boolean;
}>) {
	const internalMembers = useQuery(api.users.organization.queries.getAll);

	return (
		<SearchSelect
			aria-labelledby={labelId}
			aria-invalid={invalid}
			className="w-full sm:w-[200px]"
			items={internalMembers?.map((member) => ({ id: member.userId, label: member.fullName }))}
			value={value}
			onChange={(userId) => {
				if (userId) onChange(userId as Id<"users">);
			}}
			placeholder="Velg et medlem..."
			searchPlaceholder="Søk etter en ansvarlig..."
			emptyText="Fant ingen ansvarlige(er)."
		/>
	);
}
