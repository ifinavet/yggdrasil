"use client";

import { useForm } from "@tanstack/react-form";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Field, FieldError, FieldLabel, FieldSet } from "@workspace/ui/components/field";
import { useEffect, useState } from "react";
import DialogSaveFooter from "@/components/common/forms/dialog-save-footer";
import PositionGroupField from "@/components/common/forms/position-group-field";
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

						<form.Field name="group">{(field) => <PositionGroupField field={field} />}</form.Field>
					</FieldSet>
				</form>
				<DialogSaveFooter
					isSubmitting={form.state.isSubmitting}
					onSave={() => form.handleSubmit()}
				/>
			</DialogContent>
		</Dialog>
	);
}
