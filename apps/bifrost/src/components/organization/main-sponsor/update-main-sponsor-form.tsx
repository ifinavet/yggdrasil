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
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
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
}: Readonly<{ companyId: Id<"companies"> }>) {
	const [searchInput, setSearchInput] = useState<string>("");

	const companies = useQuery(api.companies.searchByName, {
		searchQuery: searchInput,
	});

	const updateMainSponsor = useMutation(api.companies.updateMainSponsor);

	const form = useForm({
		defaultValues: {
			companyId: companyId || ("" as Id<"companies">),
		},
		validators: {
			onSubmit: schema,
		},
		onSubmit: async ({ value }) => {
			updateMainSponsor({ companyId: value.companyId }).catch(() =>
				toast.error("Oi! Det oppstod en feil!", {
					description: "Skulle feilen vedvare kontakt webansvarlig.",
				}),
			);
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
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field className="flex flex-col">
								<FieldLabel>Endre hovedsamarbeidspartner</FieldLabel>
								<div className="space-y-2">
									<Input
										placeholder="Søk eks. ifi-navet"
										type="text"
										onChange={(e) => {
											setSearchInput(e.target.value);
										}}
									/>
									<ScrollArea className="max-h-20">
										{companies?.map((company) => (
											<Button
												key={company._id}
												type="button"
												variant="ghost"
												onClick={() => field.handleChange(company._id)}
												className={`mb-2 flex w-full justify-start ${
													field.state.value === company._id
														? "bg-primary text-primary hover:bg-primary/90 dark:text-primary-foreground"
														: ""
												}`}
											>
												{company.name}
											</Button>
										))}
									</ScrollArea>
								</div>
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
				{form.state.isSubmitting
					? "Oppdaterer..."
					: "Oppdater hovedsamarbeidspartner"}
			</Button>
		</form>
	);
}
