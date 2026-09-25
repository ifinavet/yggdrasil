"use client";

import { useForm } from "@tanstack/react-form";
import { api } from "@workspace/backend/convex/api";
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
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useConvex } from "convex/react";
import { useEffect, useId, useState } from "react";
import DialogSaveFooter from "@/components/common/forms/dialog-save-footer";
import PositionGroupField from "@/components/common/forms/position-group-field";
import {
	type InternalMemberFormValues,
	internalMemberFormSchema,
} from "@/constants/schemas/internal-member-form-shcema";

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
	const userLabelId = useId();
	const [selectedUserLabel, setSelectedUserLabel] = useState<string>();
	const convex = useConvex();
	const searchUsers = async (searchInput: string) => {
		const { page } = await convex.query(api.users.clerk.queries.searchAfterUsers, {
			searchInput,
			paginationOpts: { numItems: 10, cursor: null },
		});
		return page.map((user) => ({
			id: user._id,
			label: [user.firstName, user.lastName].join(" "),
			description: user.email,
		}));
	};

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
			setSelectedUserLabel(undefined);
		}
	}, [openDialog, form]);

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
									<FieldLabel id={userLabelId}>Velg bruker</FieldLabel>
									<SearchSelect
										aria-labelledby={userLabelId}
										className="w-full"
										search={searchUsers}
										value={field.state.value}
										valueLabel={selectedUserLabel}
										onChange={(userId, item) => {
											field.handleChange(userId ?? "");
											setSelectedUserLabel(item?.label);
										}}
										placeholder="Velg bruker"
										searchPlaceholder="Søk etter epost, eks. olanord@uio.no"
										emptyText="Fant ingen brukere."
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
