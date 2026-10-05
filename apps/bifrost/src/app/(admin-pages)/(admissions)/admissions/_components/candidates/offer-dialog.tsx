"use client";
import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
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
import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";

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
	const { error, run } = useAsyncAction();
	const groups = useQuery(api.admissions.queries.availableGroups, {});
	const form = useForm({
		defaultValues: {
			group: initialGroup ?? "",
			email: initialEmail,
		},
		onSubmit: ({ value }) =>
			run(
				async () => {
					const selected = groups?.find((group) => group._id === value.group);
					if (!selected) throw new ConvexError("Velg en arbeidsgruppe.");
					await onSave(selected._id, value.email);
					onClose();
				},
				undefined,
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
