"use client";

import { useMutation } from "@tanstack/react-query";
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod/v4";
import { signUp } from "@/lib/query/registration";
import { zodv4Resolver } from "@/uitls/zod-v4-resolver";

const formSchema = z.object({
	notes: z.optional(z.string()),
});

export default function SignUpForm({
	event_id,
	user_id,
	className,
	waitlist,
}: {
	className?: string;
	event_id: number;
	user_id: string;
	waitlist: boolean;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodv4Resolver(formSchema),
		defaultValues: {
			notes: "",
		},
	});

	const { mutate } = useMutation({
		mutationKey: ["signUp"],
		mutationFn: (values: z.infer<typeof formSchema>) =>
			signUp(event_id, user_id, waitlist, values.notes),
		onError: (error) => {
			console.error(error);
			toast.error("Oops! Noe gikk galt! Prøv igjen senere.");
		},
		onSuccess: () => {
			setOpen(false);
			router.refresh();
		},
	});

	const onSubmit = (data: z.infer<typeof formSchema>) => {
		mutate(data);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button className={className} type='button' onClick={() => setOpen(true)}>
					{waitlist ? "Det er fult! Meld deg på ventelisten" : "Meld deg på"}
				</Button>
			</DialogTrigger>
			<DialogContent className='sm:max-w-[425px]'>
				<DialogHeader>
					<DialogTitle>Meld meg på</DialogTitle>
					<DialogDescription>
						Meld deg på bedriftspresentasjonen! Dersom du har noen algerier eller andre ting vi
						burde vite om, ber vi deg vennligst oppi dem nå.
					</DialogDescription>
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
					<DialogClose asChild>
						<Button variant='outline'>Avbryt</Button>
					</DialogClose>
					<Button type='submit' onClick={form.handleSubmit(onSubmit)}>
						Meld meg på {waitlist && "ventelisten"}!
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
