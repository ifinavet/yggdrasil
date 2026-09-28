"use client";

import { api } from "@workspace/backend/convex/api";
import { isUioEmail, normalizeEmail, uioEmailSchema } from "@workspace/shared/iam";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useConvex } from "convex/react";
import { useRef } from "react";

export type UioUser = { email: string; firstName: string; lastName: string };

export function UioUserSearch({
	value,
	onChange,
	"aria-labelledby": labelledBy,
	"aria-invalid": invalid,
}: Readonly<{
	value: string;
	onChange: (user: UioUser) => void;
	"aria-labelledby"?: string;
	"aria-invalid"?: boolean;
}>) {
	const convex = useConvex();
	const found = useRef(new Map<string, UioUser>()).current;

	const search = async (query: string) => {
		const users = await convex.query(api.iam.queries.searchUioUsers, { query });
		const typed = normalizeEmail(query);
		const items = users.map((user) => {
			found.set(user.email, user);
			return {
				id: user.email,
				label: `${user.firstName} ${user.lastName}`,
				description: user.email,
			};
		});
		if (uioEmailSchema.safeParse(typed).success && !found.has(typed)) {
			found.set(typed, { email: typed, firstName: "", lastName: "" });
			items.push({ id: typed, label: typed, description: "Har ikke logget inn i Bifrost ennå" });
		}
		return items;
	};

	return (
		<SearchSelect
			aria-labelledby={labelledBy}
			aria-invalid={invalid}
			className="w-full"
			search={search}
			minQueryLength={2}
			value={value || null}
			valueLabel={value && isUioEmail(value) ? value : undefined}
			onChange={(id) => {
				const user = id ? found.get(id) : undefined;
				if (user) onChange(user);
			}}
			placeholder="Søk etter navn eller UiO-adresse"
			searchPlaceholder="Navn eller brukernavn@uio.no"
			emptyText="Fant ingen med UiO-bruker. Skriv hele UiO-adressen."
		/>
	);
}
