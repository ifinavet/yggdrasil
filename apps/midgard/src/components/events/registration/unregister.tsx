"use client";

import { useMutation } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteRegistration } from "@/lib/query/registration";

export default function Unregister({ user_id, event_id }: { user_id: string; event_id: number }) {
	const router = useRouter();

	const { mutate } = useMutation({
		mutationKey: ["unregister"],
		mutationFn: () => deleteRegistration(user_id, event_id),
		onSuccess: () => {
			router.refresh();
		},
		onError: () => {
			toast.error("Oi! Noe gikk galt! Prøv igjen senere.");
		},
	});

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					type='button'
					className='w-1/2 rounded-xl bg-zinc-500 py-8 text-lg hover:cursor-pointer hover:bg-zinc-700'
				>
					Meld meg av
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Er du sikker?</AlertDialogTitle>
					<AlertDialogDescription>
						Dersom du melder deg av og det er folk på venteliste, vil miste din plass og havne på
						venteliste dersom du melder deg opp på nytt. NB! Melder du det av under 24 timer før
						arrangementet vil du få en prikk.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Avbryt</AlertDialogCancel>
					<AlertDialogAction onClick={() => mutate()}>
						Jeg er helt sikker, meld meg av.
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
