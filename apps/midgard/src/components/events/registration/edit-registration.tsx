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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod/v4";
import { humanReadableDateTime } from "@/uitls/dateFormatting";
import { zodv4Resolver } from "@/uitls/zod-v4-resolver";
import Unregister from "./unregister";

const formSchema = z.object({
  notes: z.optional(z.string()),
});

export default function EditRegistration({
  registration,
}: {
  registration: Doc<"registrations">;
}) {
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodv4Resolver(formSchema),
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
          className='w-1/2 rounded-xl bg-zinc-500 py-8 text-lg hover:cursor-pointer hover:bg-zinc-700'
          onClick={() => setOpen(true)}
        >
          Rediger din påmelding
        </Button>
      </DialogTrigger>
      <DialogContent>
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
            <Unregister registrationId={registration._id} />
            <Button type='submit' onClick={form.handleSubmit(onSubmit)}>
              Lagre Endringer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
