"use client";

import { api } from "@workspace/backend/convex/api";
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useQuery } from "convex/react";
import { useId } from "react";

export type SelectedCompany = {
	readonly name: string;
	readonly id: string;
};

export default function CompanySelectField({
	company,
	onCompanyChange,
	errors,
	isInvalid,
}: Readonly<{
	company: SelectedCompany;
	onCompanyChange: (company: SelectedCompany) => void;
	errors: Array<{ message?: string } | undefined>;
	isInvalid: boolean;
}>) {
	const labelId = useId();
	const companies = useQuery(api.companies.queries.getAll);

	return (
		<Field className="min-w-0 md:w-full">
			<FieldLabel id={labelId}>Velg arrangerende bedrift</FieldLabel>
			<SearchSelect
				aria-labelledby={labelId}
				aria-invalid={isInvalid}
				items={companies?.map(({ _id, name }) => ({ id: _id, label: name }))}
				value={company.id}
				valueLabel={company.name || undefined}
				onChange={(id, item) => {
					if (id && item) onCompanyChange({ id, name: item.label });
				}}
				placeholder="Velg en bedrift..."
				searchPlaceholder="Søk etter bedrift..."
				emptyText="Fant ingen bedrift(er)."
			/>
			{isInvalid && <FieldError errors={errors} />}
			<FieldDescription>Velg hvilken bedrift annonsen skal være knyttet til</FieldDescription>
		</Field>
	);
}
