"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
	Form,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useMutation } from "convex/react";
import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod/v4";
import { humanReadableDateTime } from "@/utils/dateFormatting";
import createCalendarEventIcs from "@/utils/icsCalendarEvent";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";
import Unregister from "./unregister";

const formSchema = z.object({
	notes: z.optional(z.string()),
});

export default function EditRegistration({
	registration,
	disabled,
	event,
}: Readonly<{
	registration: Doc<"registrations">;
	disabled: boolean;
	event: Doc<"events">;
}>) {
	const [open, setOpen] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodV4Resolver(formSchema),
		defaultValues: {
			notes: registration.note,
		},
	});

	const updateNote = useMutation(api.registration.updateNote);
	const onSubmit = async (data: z.infer<typeof formSchema>) =>
		updateNote({ id: registration._id, note: data.notes })
			.then(() => {
				toast("Din endring ble lagret", {
					description: humanReadableDateTime(new Date()),
					position: "top-center",
				});
				form.reset();
				setOpen(false);
			})
			.catch(() => {
				toast.error("Oi! Det oppstod en feil! Prøv igjen senere");
			});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type='button'
					className='!opacity-100 w-3/4 whitespace-normal text-balance rounded-xl bg-violet-400 py-8 text-lg text-primary-foreground hover:cursor-pointer hover:bg-violet-500 md:w-1/2 dark:bg-violet-300 dark:text-zinc-800'
					onClick={() => setOpen(true)}
					disabled={disabled}
				>
					Rediger din påmelding
				</Button>
			</DialogTrigger>
			<DialogContent aria-description='Rediger påmelding'>
				<DialogHeader>
					<DialogTitle>Rediger din påmelding</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)}>
						<FormField
							control={form.control}
							name='notes'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Allergier eller andre merknader</FormLabel>
									<Input {...field} />
									<FormDescription>Har du noen allergier, eller andre merknader?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>
				<DialogFooter>
					<div className='flex w-full justify-between'>
						<div>
							<Button
								variant='outline'
								onClick={() =>
									createCalendarEventIcs(
										event.title,
										event.description,
										event.location,
										event.eventStart,
									)
								}
							>
								<CalendarPlus />
								Legg til i kalenderen
							</Button>
						</div>
						<div className='flex gap-2'>
							<Unregister registrationId={registration._id} eventId={event._id} />
							<Button
								type='submit'
								className='text-primary-foreground'
								onClick={form.handleSubmit(onSubmit)}
							>
								Lagre Endringer
							</Button>
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
