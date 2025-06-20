"use client";

import { Send, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodv4Resolver } from "@/lib/zod-v4-resolver";
import type { CompanyFormValues } from "@/utils/bifrost/schemas/companies-form-schema";
import { formSchema } from "@/utils/bifrost/schemas/companies-form-schema";
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
      <form
        onSubmit={form.handleSubmit(onPrimarySubmitAction)}
        className="space-y-8"
      >
        <FormField
          control={form.control}
          name="company_name"
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
          name="org_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Org. nr.</FormLabel>
              <Input {...field} />
              <FormDescription>
                Skriv inn bedriftens organisasjonsnummer her.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="company_image"
          render={() => (
            <FormItem>
              <FormLabel>Bedrifts bilde</FormLabel>
              <SelectImage form={form} />
              <FormDescription>
                Velg et bilde for bedriften her.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <DescriptionEditor form={form} />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          <Send />{" "}
          {form.formState.isSubmitting ? "Jobber..." : "Lagre og publiser"}
        </Button>
        {onSecondarySubmitAction && (
          <Button
            type="button"
            disabled={form.formState.isSubmitting}
            variant="destructive"
            onClick={form.handleSubmit(onSecondarySubmitAction)}
          >
            <Trash />{" "}
            {form.formState.isSubmitting ? "Jobber..." : "Slett Bedrift"}
          </Button>
        )}
      </form>
    </Form>
  );
}
