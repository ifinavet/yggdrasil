"use client";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { useAppForm } from "@workspace/ui/components/form";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { toast } from "sonner";
import type { Candidate } from "../model";

export function OfferDialog({
	candidate,
	onClose,
}: Readonly<{
	candidate: Candidate;
	onClose: () => void;
}>) {
	const { error, run } = useAsyncAction();
	const setDecision = useMutation(api.admissions.mutations.setDecision);
	const groups = useQuery(api.admissions.queries.availableGroups, {});
	const form = useAppForm({
		defaultValues: {
			group: candidate.reviewedGroupId ?? candidate.groupId ?? "",
			email: candidate.reviewedWorkspaceEmail ?? "",
		},
		onSubmit: ({ value }) =>
			run(
				async () => {
					const selected = groups?.find((group) => group._id === value.group);
					if (!selected) throw new ConvexError("Velg en arbeidsgruppe.");
					await setDecision({
						applicationId: candidate._id,
						expectedRevision: candidate.revision,
						decision: "accepted",
						reviewedGroupId: selected._id,
						reviewedWorkspaceEmail: value.email,
					});
				},
				() => {
					toast.success("Tilbudet er lagret");
					onClose();
				},
				"Kunne ikke lagre tilbudet.",
			),
	});
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>Tilbud til {candidate.name}</DialogTitle>
				</DialogHeader>
				<form
					className="grid gap-6"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					{error && (
						<p role="alert" className="text-destructive">
							{error}
						</p>
					)}
					<form.Field name="group">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="offer-group">Arbeidsgruppe</FieldLabel>
								<SearchSelect
									id="offer-group"
									value={field.state.value}
									onChange={(value) => field.handleChange(value ?? "")}
									disabled={!groups?.length}
									placeholder="Velg arbeidsgruppe"
									searchPlaceholder="Søk etter arbeidsgruppe"
									items={groups?.map(({ _id, name }) => ({ id: _id, label: name }))}
								/>
							</Field>
						)}
					</form.Field>
					{groups?.length === 0 && (
						<Link href="/organization" className="text-primary underline">
							Legg til en arbeidsgruppe
						</Link>
					)}
					<form.AppField name="email">
						{(field) => (
							<field.Input label="Navet-adresse" id="offer-email" type="email" required />
						)}
					</form.AppField>
					<form.Subscribe
						selector={(state) =>
							state.isSubmitting || !groups?.some((group) => group._id === state.values.group)
						}
					>
						{(submitting) => (
							<Button type="submit" disabled={submitting}>
								Lagre tilbud
							</Button>
						)}
					</form.Subscribe>
				</form>
			</DialogContent>
		</Dialog>
	);
}
