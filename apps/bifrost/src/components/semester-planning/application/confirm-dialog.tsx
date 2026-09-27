"use client";

import { useForm } from "@tanstack/react-form";
import { MAX_OFFER_COMMENT_LENGTH } from "@workspace/shared/semester/limits";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";
import type { ReactNode } from "react";
import { z } from "zod";

type CommentField = {
	label: string;
	/** Makes the comment required, with this message when it is empty. */
	requiredMessage?: string;
};

function commentSchema(comment: CommentField | undefined) {
	const text = z
		.string()
		.trim()
		.max(MAX_OFFER_COMMENT_LENGTH, `Kommentaren kan ha høyst ${MAX_OFFER_COMMENT_LENGTH} tegn.`);
	return z.object({
		comment: comment?.requiredMessage ? text.min(1, comment.requiredMessage) : text,
	});
}

/**
 * Asks before a status change that cannot simply be undone, optionally with a comment for the
 * history. `onConfirm` returns whether it worked; the dialog stays open on an error.
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	comment,
	confirmLabel,
	destructive = false,
	onConfirm,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: ReactNode;
	comment?: CommentField;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: (comment: string | undefined) => Promise<boolean>;
}>) {
	const form = useForm({
		defaultValues: { comment: "" },
		validators: { onSubmit: commentSchema(comment) },
		onSubmit: async ({ value, formApi }) => {
			const trimmed = value.comment.trim();
			if (await onConfirm(trimmed || undefined)) {
				formApi.reset();
				onOpenChange(false);
			}
		},
	});

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (!next) form.reset();
				onOpenChange(next);
			}}
		>
			<AlertDialogContent>
				<form
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>{title}</AlertDialogTitle>
						<AlertDialogDescription>{description}</AlertDialogDescription>
					</AlertDialogHeader>

					{comment && (
						<form.Field name="comment">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="status-comment">{comment.label}</FieldLabel>
										<Textarea
											id="status-comment"
											value={field.state.value}
											onChange={(event) => field.handleChange(event.target.value)}
											onBlur={field.handleBlur}
											aria-invalid={isInvalid}
											rows={3}
										/>
										{isInvalid && (
											<FieldError className="font-medium" errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
					)}

					<AlertDialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Avbryt
						</Button>
						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<Button
									type="submit"
									variant={destructive ? "destructive" : "default"}
									disabled={isSubmitting}
								>
									{isSubmitting ? "Jobber..." : confirmLabel}
								</Button>
							)}
						</form.Subscribe>
					</AlertDialogFooter>
				</form>
			</AlertDialogContent>
		</AlertDialog>
	);
}
