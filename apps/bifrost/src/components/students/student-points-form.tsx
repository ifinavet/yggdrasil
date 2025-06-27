"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
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
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod/v4";
import { giveStudentPoints } from "@/lib/queries/users/students";
import { zodv4Resolver } from "@/utils/zod-v4-resolver";

const pointsSchema = z.object({
  severity: z.number().min(1).max(3),
  reason: z
    .string()
    .min(
      1,
      "Vennligst oppgi en begrunnelse. Det er viktig at vi informerer studenten om hvorfor prikken(e) ble gitt.",
    ),
});

export default function StudentPointsForm({ user_id }: { user_id: string }) {
  const form = useForm<z.Infer<typeof pointsSchema>>({
    resolver: zodv4Resolver(pointsSchema),
    defaultValues: {
      severity: 1,
      reason: "",
    },
  });

  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: (values: z.Infer<typeof pointsSchema>) => giveStudentPoints(user_id, values),
    onSuccess: () => {
      toast.success("Prikken(e) vellykket gitt");
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["studentPoints", user_id] });
    },
    onError: () => {
      toast.error("Noe gikk galt. Vennligst prøv igjen senere.");
    },
  });

  const onSubmit = (values: z.Infer<typeof pointsSchema>) => {
    mutate(values);
  };

  return (
    <Form {...form}>
      <form className='space-y-8' onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name='reason'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Begunnelse</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Beskriv hvorfor studenten har fått prikken(e). Denne beskrivelsen vil være synlig
                for studenten.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='severity'
          render={({ field }) => (
            <FormItem className=''>
              <FormLabel>Velg antall runder</FormLabel>
              <RadioGroup
                value={field.value.toString()}
                onValueChange={(e) => field.onChange(Number.parseInt(e))}
                defaultValue='1'
                className='grid grid-cols-1 md:grid-cols-3 gap-4'
              >
                <FormControl>
                  <div className='flex items-center space-x-2 h-full'>
                    <Label
                      className='has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-primary/5 flex items-start gap-3 rounded-lg border p-3 cursor-pointer h-full'
                      htmlFor='1'
                    >
                      <RadioGroupItem
                        value='1'
                        id='1'
                        className='data-[state=checked]:border-primary'
                      />
                      <div className='grid gap-1 font-normal'>
                        <div className='font-medium'>1 prikk</div>
                        <div className='text-muted-foreground pr-2 text-xs leading-snug text-balance'>
                          Mindre forseelser, gis automatisk ved sen avmelding.
                        </div>
                      </div>
                    </Label>
                  </div>
                </FormControl>
                <FormControl>
                  <div className='flex items-center space-x-2 h-full'>
                    <Label
                      className='has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-primary/5 flex items-start gap-3 rounded-lg border p-3 cursor-pointer h-full'
                      htmlFor='2'
                    >
                      <RadioGroupItem
                        value='2'
                        id='2'
                        className='data-[state=checked]:border-primary'
                      />
                      <div className='grid gap-1 font-normal'>
                        <div className='font-medium'>2 prikker</div>
                        <div className='text-muted-foreground pr-2 text-xs leading-snug text-balance'>
                          Større brudd på rettningslinjer
                        </div>
                      </div>
                    </Label>
                  </div>
                </FormControl>
                <FormControl>
                  <div className='flex items-center space-x-2 h-full'>
                    <Label
                      className='has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-primary/5 flex items-start gap-3 rounded-lg border p-3 cursor-pointer h-full'
                      htmlFor='3'
                    >
                      <RadioGroupItem
                        value='3'
                        id='3'
                        className='data-[state=checked]:border-primary'
                      />
                      <div className='grid gap-1 font-normal'>
                        <div className='font-medium'>3 prikker</div>
                        <div className='text-muted-foreground pr-2 text-xs leading-snug text-balance'>
                          Alvorlige brudd, vil medføre påmeldings nekt.
                        </div>
                      </div>
                    </Label>
                  </div>
                </FormControl>
              </RadioGroup>
              <FormDescription>Velg antall runder som skal spilles.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' className='mt-4' onClick={form.handleSubmit(onSubmit)}>
          Send inn
        </Button>
      </form>
    </Form>
  );
}
