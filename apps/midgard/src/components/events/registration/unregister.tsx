"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
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
import { useMutation } from "convex/react";
import { toast } from "sonner";

export default function Unregister({ registrationId }: { registrationId: Id<"registrations"> }) {

  const unregister = useMutation(api.registration.unregister)
  const onUnregister = () => unregister({ id: registrationId }).catch(() => {
    toast.error("O! Noe gikk galt! Prøv igjen senere")
  })

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
          <AlertDialogAction onClick={onUnregister}>Jeg er helt sikker, meld meg av.</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
