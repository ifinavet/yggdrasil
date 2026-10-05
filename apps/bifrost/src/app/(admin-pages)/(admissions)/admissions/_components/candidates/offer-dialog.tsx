"use client";
import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

export function OfferDialog({
	name,
	initialGroup,
	initialEmail,
	onSave,
	onClose,
}: Readonly<{
	name: string;
	initialGroup?: Id<"internalGroups">;
	initialEmail: string;
	onSave: (group: Id<"internalGroups">, email: string) => Promise<void>;
	onClose: () => void;
}>) {
	const [error, setError] = useState("");
	const groups = useQuery(api.admissions.queries.availableGroups, {});
	const form = useForm({
		defaultValues: {
			group: initialGroup ?? "",
			email: initialEmail,
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				const selected = groups?.find((group) => group._id === value.group);
				if (!selected) {
					setError("Velg en arbeidsgruppe.");
					return;
				}
				await onSave(selected._id, value.email);
				onClose();
			} catch (cause) {
				setError(convexErrorMessage(cause, "Kunne ikke lagre tilbudet."));
			}
		},
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
					<DialogTitle>Tilbud til {name}</DialogTitle>
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
								<Select
									value={field.state.value}
									onValueChange={field.handleChange}
									disabled={!groups?.length}
								>
									<SelectTrigger id="offer-group">
										<SelectValue placeholder="Velg arbeidsgruppe" />
									</SelectTrigger>
									<SelectContent>
										{groups?.map((group) => (
											<SelectItem key={group._id} value={group._id}>
												{group.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>
					{groups?.length === 0 && (
						<Link href="/organization" className="text-primary underline">
							Legg til en arbeidsgruppe
						</Link>
					)}
					<form.Field name="email">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="offer-email">Navet-adresse</FieldLabel>
								<Input
									id="offer-email"
									type="email"
									required
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
								/>
							</Field>
						)}
					</form.Field>
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
