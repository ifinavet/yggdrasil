"use client";

import { Button } from "@workspace/ui/components//button";
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components//form";
import { Input } from "@workspace/ui/components//input";
import { Send, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { type CompanyFormValues, formSchema } from "@/constants/schemas/companies-form-schema";
import { zodv4Resolver } from "@/utils/zod-v4-resolver";
import DescriptionEditor from "./description-editor";
import SelectImage from "./select-image";

export default function CompanyForm({
  defaultValues,
  onPrimarySubmitAction,
  onSecondarySubmitAction,
}: {
  defaultValues: CompanyFormValues;
  onPrimarySubmitAction: (values: CompanyFormValues) => void;
  onSecondarySubmitAction?: (values: CompanyFormValues) => void;
}) {
  const form = useForm<CompanyFormValues>({
    resolver: zodv4Resolver(formSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onPrimarySubmitAction)} className='space-y-8'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bedrifts navn</FormLabel>
              <Input {...field} />
              <FormDescription>Skriv inn bedriftens navn her.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='orgNumber'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Org. nr.</FormLabel>
              <Input {...field} />
              <FormDescription>Skriv inn bedriftens organisasjonsnummer her.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='image'
          render={() => (
            <FormItem>
              <FormLabel>Bedrifts bilde</FormLabel>
              <SelectImage form={form} />
              <FormDescription>Velg et bilde for bedriften her.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <DescriptionEditor form={form} />

        <div className='mb-4 flex gap-4'>
          <Button type='submit' disabled={form.formState.isSubmitting}>
            <Send /> {form.formState.isSubmitting ? "Jobber..." : "Lagre og publiser"}
          </Button>
          {onSecondarySubmitAction && (
            <Button
              type='button'
              disabled={form.formState.isSubmitting}
              variant='destructive'
              onClick={form.handleSubmit(onSecondarySubmitAction)}
            >
              <Trash /> {form.formState.isSubmitting ? "Jobber..." : "Slett Bedrift"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
