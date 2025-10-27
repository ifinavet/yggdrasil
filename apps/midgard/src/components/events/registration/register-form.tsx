"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
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
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useMutation } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod/v4";
import { zodV4Resolver } from "@/utils/zod-v4-resolver";

const formSchema = z.object({
	notes: z.optional(z.string()),
});

export default function RegisterForm({
	eventId,
	className,
	waitlist,
	disabled,
}: Readonly<{
	className?: string;
	eventId: Id<"events">;
	userId: Id<"users">;
	waitlist: boolean;
	disabled: boolean;
}>) {
	const [open, setOpen] = useState(false);
	const postHog = usePostHog();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodV4Resolver(formSchema),
		defaultValues: {
			notes: "",
		},
	});

	const signUp = useMutation(api.registration.register);
	const onSubmit = (data: z.infer<typeof formSchema>) =>
		signUp({ note: data.notes, eventId })
			.then((status) => {
				if (status === "waitlist" && waitlist === false) {
					toast.warning(
						"Her gikk det unna! Du står nå på ventelisten og vil få en epost dersom det skulle bli en ledig plass til deg",
					);
				}
				postHog.capture("midgard-student_register", {
					eventId,
					status: status,
				});
				setOpen(false);
			})
			.catch(() => {
				toast.error("Oops! Noe gikk galt! Prøv igjen senere.");
			});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					className={className}
					type="button"
					onClick={() => setOpen(true)}
					disabled={disabled}
				>
					{waitlist ? "Det er fullt! Meld deg på venteliste" : "Meld deg på"}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:min-w-[50ch] sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Meld meg på</DialogTitle>
					<DialogDescription className="">
						Meld deg på bedriftspresentasjonen! Dersom du har noen algerier
						eller andre ting vi burde vite om, ber vi deg vennligst oppi dem nå.{" "}
						<span className="font-bold">
							NB! Dersom du melder deg på sent, eller blir flyttet fra
							ventelisten sent, så er det ikke sikker at vi kan ta hensyn til
							allergener.
						</span>
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)}>
						<FormField
							control={form.control}
							name="notes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Allergier eller andre merknader</FormLabel>
									<Input {...field} />
									<FormDescription>
										Har du noen allergier, eller andre merknader?
									</FormDescription>
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
					<Button
						type="submit"
						onClick={form.handleSubmit(onSubmit)}
						className="text-primary-foreground"
					>
						Meld meg på {waitlist && "ventelisten"}!
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
