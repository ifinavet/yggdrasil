"use client";

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
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
	type InternalMemberFormValues,
	internalMemberFormSchema,
} from "@/constants/schemas/internal-member-form-shcema";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";
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
}: {
	defaultValues: InternalMemberFormValues;
	onSubmitAction: (values: InternalMemberFormValues) => void;
	description: string;
	title: string;
	openDialog: boolean;
	setOpenDialogAction: (open: boolean) => void;
	button: React.ReactNode;
	className?: string;
}) {
	const form = useForm<InternalMemberFormValues>({
		resolver: zodV4Resolver(internalMemberFormSchema),
		defaultValues,
	});

	useEffect(() => {
		if (!openDialog) {
			form.reset(defaultValues);
		}
	}, [openDialog, defaultValues, form]);

	const [selectedUser, setSelectedUser] = useState<Doc<"users"> | null>(null);

	const handleUserSelect = (user: Doc<"users"> | null) => {
		setSelectedUser(user);
		form.setValue("userId", user?._id || "");
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
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmitAction)} className="space-y-8">
						<FormField
							control={form.control}
							name="userId"
							render={() => (
								<FormItem className="flex flex-col">
									<FormLabel>Velg bruker</FormLabel>
									<FormControl>
										<NewInternalSearch
											selectedUser={selectedUser}
											setSelectedUserAction={handleUserSelect}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="group"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Gruppe</FormLabel>
									<FormControl>
										<Input {...field} placeholder="f.eks. Webgruppen" />
									</FormControl>
									<FormDescription>Hva skal gruppen til vervet hete?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Avbryt</Button>
					</DialogClose>
					<Button type="submit" onClick={form.handleSubmit(onSubmitAction)}>
						Lagre
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
