"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useConvex, useMutation } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";

const schema = z.object({
	companyId: z.custom<Id<"companies">>(
		(val) => typeof val === "string",
		"Vennligst velg en bedrift, til å være hovedsamarbeidspartner",
	),
});

export default function UpdateMainSponsorForm({
	companyId,
	companyName: initialCompanyName,
}: Readonly<{ companyId: Id<"companies">; companyName: string }>) {
	const labelId = useId();
	const [companyName, setCompanyName] = useState(initialCompanyName);
	const convex = useConvex();
	const searchCompanies = async (searchQuery: string) => {
		const companies = await convex.query(api.companies.queries.searchByName, { searchQuery });
		return companies.map((company) => ({ id: company._id, label: company.name }));
	};

	const updateMainSponsor = useMutation(api.companies.mutations.updateMainSponsor);

	const form = useForm({
		defaultValues: {
			companyId: companyId || ("" as Id<"companies">),
		},
		validators: {
			onSubmit: schema,
		},
		onSubmit: async ({ value }) => {
			updateMainSponsor({ companyId: value.companyId }).catch((err) => {
				toast.error("Oi! Det oppstod en feil!", {
					description: "Skulle feilen vedvare kontakt webansvarlig.",
				});
				throw err;
			});
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<FieldSet>
				<form.Field name="companyId">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field className="flex flex-col">
								<FieldLabel id={labelId}>Endre hovedsamarbeidspartner</FieldLabel>
								<SearchSelect
									aria-labelledby={labelId}
									aria-invalid={isInvalid}
									className="w-full"
									search={searchCompanies}
									value={field.state.value}
									valueLabel={companyName}
									onChange={(id, item) => {
										if (!id || !item) return;
										field.handleChange(id as Id<"companies">);
										setCompanyName(item.label);
									}}
									placeholder="Velg en bedrift..."
									searchPlaceholder="Søk eks. ifi-navet"
									emptyText="Fant ingen bedrift(er)."
								/>
								<FieldDescription>
									Søk og velg en bedrift til å være hovedsamarbeidspartner.
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</FieldSet>

			<Button type="submit" disabled={form.state.isSubmitting}>
				{form.state.isSubmitting ? "Oppdaterer..." : "Oppdater hovedsamarbeidspartner"}
			</Button>
		</form>
	);
}
