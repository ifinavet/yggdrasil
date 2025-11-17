"use client";

import { useForm } from "@tanstack/react-form";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useEffect, useState } from "react";
import {
	type InternalMemberFormValues,
	internalMemberFormSchema,
} from "@/constants/schemas/internal-member-form-shcema";
import NewInternalSearch from "./new-internal-search";

export default function InternalMemberForm({
	defaultValues,
	onSubmitAction,
	description,
	title,
	openDialog,
	setOpenDialogAction,
	button,
	className,
}: Readonly<{
	defaultValues: InternalMemberFormValues;
	onSubmitAction: (values: InternalMemberFormValues) => void;
	description: string;
	title: string;
	openDialog: boolean;
	setOpenDialogAction: (open: boolean) => void;
	button: React.ReactNode;
	className?: string;
}>) {
	const [selectedUser, setSelectedUser] = useState<Doc<"users"> | null>(null);

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: internalMemberFormSchema,
		},
		onSubmit: async ({ value }) => {
			onSubmitAction(value);
		},
	});

	useEffect(() => {
		if (!openDialog) {
			form.reset();
		}
	}, [openDialog, form]);

	const handleUserSelect = (user: Doc<"users"> | null) => {
		setSelectedUser(user);
		form.setFieldValue("userId", user?._id || "");
	};

	return (
		<Dialog open={openDialog} onOpenChange={setOpenDialogAction}>
			<DialogTrigger asChild>
				<Button variant="default" size="sm" className={className}>
					{button}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-8"
				>
					<FieldSet>
						<form.Field name="userId">
							{(field) => (
								<Field className="flex flex-col">
									<FieldLabel>Velg bruker</FieldLabel>
									<NewInternalSearch
										selectedUser={selectedUser}
										setSelectedUserAction={handleUserSelect}
									/>
									{field.state.meta.isTouched && !field.state.meta.isValid && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							)}
						</form.Field>

						<form.Field name="group">
							{(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field>
										<FieldLabel htmlFor={field.name}>Gruppe</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											aria-invalid={isInvalid}
											placeholder="f.eks. Webgruppen"
										/>
										<FieldDescription>
											Hva skal gruppen til vervet hete?
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						</form.Field>
					</FieldSet>
				</form>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Avbryt</Button>
					</DialogClose>
					<Button
						type="submit"
						disabled={form.state.isSubmitting}
						onClick={() => form.handleSubmit()}
					>
						{form.state.isSubmitting ? "Lagrer..." : "Lagre"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
