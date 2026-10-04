"use client";
import { useForm } from "@tanstack/react-form";
import { ADMISSION_GROUPS } from "@workspace/shared/admissions";
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
import { useState } from "react";

export function OfferDialog({
	name,
	initialGroup,
	initialEmail,
	onSave,
	onClose,
}: Readonly<{
	name: string;
	initialGroup: string;
	initialEmail: string;
	onSave: (group: string, email: string) => Promise<void>;
	onClose: () => void;
}>) {
	const [error, setError] = useState("");
	const form = useForm({
		defaultValues: {
			group: initialGroup === "Usikker ennå" ? "" : initialGroup,
			email: initialEmail,
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				await onSave(value.group, value.email);
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
								<Select value={field.state.value} onValueChange={field.handleChange}>
									<SelectTrigger id="offer-group">
										<SelectValue placeholder="Velg arbeidsgruppe" />
									</SelectTrigger>
									<SelectContent>
										{ADMISSION_GROUPS.filter((group) => group !== "Usikker ennå").map((group) => (
											<SelectItem key={group} value={group}>
												{group}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>
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
					<form.Subscribe selector={(state) => state.isSubmitting}>
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
