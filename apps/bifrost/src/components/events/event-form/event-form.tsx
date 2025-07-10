"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components//button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components//command";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components//form";
import { Input } from "@workspace/ui/components//input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components//popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components//select";
import { Separator } from "@workspace/ui/components//separator";
import { Textarea } from "@workspace/ui/components//textarea";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown, EyeOff, Save, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { type EventFormValues, formSchema } from "@/constants/schemas/event-form-schema";
import { getAllCompanies } from "@/lib/queries/companies";
import { zodv4Resolver } from "@/utils/zod-v4-resolver";
import DateTimePicker from "./date-time-picker";
import DescriptionEditor from "./description-editor";
import Organizers from "./organizers";

export default function EventForm({
  onDefaultSubmitAction,
  onSecondarySubmitAction,
  onTertiarySubmitAction,
  defaultValues,
}: {
  onDefaultSubmitAction: (values: EventFormValues) => void;
  onSecondarySubmitAction: (values: EventFormValues) => void;
  onTertiarySubmitAction?: (values: EventFormValues) => void;
  defaultValues: EventFormValues;
}) {
  const form = useForm<EventFormValues>({
    resolver: zodv4Resolver(formSchema),
    defaultValues: defaultValues,
  });

  const watchedEventType = form.watch("eventType");

  const [openCompanies, setOpenCompanies] = useState(false);
  const [companyValue, setCompanyValue] = useState(form.watch("hostingCompany").company_name);

  const isExternalEvent = useMemo(() => watchedEventType === "external_event", [watchedEventType]);

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: getAllCompanies,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onDefaultSubmitAction)} className='space-y-8'>
        {/* Title */}
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tittel</FormLabel>
              <FormControl>
                <Input placeholder='Bedriftspresentasjon med Navet' {...field} />
              </FormControl>
              <FormDescription>Dette er hva arrangementet skal hete.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />

        {/* Event metadata */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <FormField
            control={form.control}
            name='food'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mat</FormLabel>
                <FormControl>
                  <Input placeholder='Sushi' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='location'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sted</FormLabel>
                <FormControl>
                  <Input placeholder='Månen' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='participantsLimit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deltaker grense</FormLabel>
                <FormControl>
                  <Input
                    placeholder='40'
                    type='number'
                    value={field.value === 0 ? "" : field.value}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === "") {
                        field.onChange(0);
                      } else {
                        const numValue = Number.parseInt(inputValue, 10);
                        field.onChange(Number.isNaN(numValue) ? 0 : numValue);
                      }
                    }}
                    name={field.name}
                    min='0'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ageRestrictions'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aldersbegrensninger</FormLabel>
                <FormControl>
                  <Input placeholder='18 års aldersgrense' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='language'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Språk</FormLabel>
                <FormControl>
                  <Input placeholder='Norsk' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='hostingCompany'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Velg arrangerende bedrift</FormLabel>
                <Popover open={openCompanies} onOpenChange={setOpenCompanies}>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      aria-expanded={openCompanies}
                      className='justify-between'
                    >
                      {companyValue
                        ? companies?.find((company) => company.company_name === companyValue)
                          ?.company_name
                        : "Velg en bedrift..."}
                      <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-[200px] p-0' align='start'>
                    <Command>
                      <CommandInput placeholder='Søk etter bedrift...' />
                      <CommandList>
                        <CommandEmpty>Fant ingen bedrift(er).</CommandEmpty>
                        <CommandGroup>
                          {companies?.map((company) => (
                            <CommandItem
                              key={company.company_id}
                              value={company.company_name}
                              onSelect={(currentValue) => {
                                setCompanyValue(currentValue === companyValue ? "" : currentValue);
                                field.onChange(company);
                                setOpenCompanies(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  companyValue === company.company_name
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {company.company_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Separator />

        {/* Event time and date pickers */}
        <div className='grid gap-4 sm:grid-cols-2'>
          <DateTimePicker
            form={form}
            formField='eventDate'
            label='Dato og tid for arrangements start'
            description='Velg dato og tid for når arrangementet starter'
          />
          <DateTimePicker
            form={form}
            formField='registrationDate'
            label='Dato og tid for åpning av påmelding'
            description='Velg dato og tid for åpning av påmeldingen av arrangementet'
          />
        </div>
        <Separator />

        {/* Teaser */}
        <FormField
          control={form.control}
          name='teaser'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teaser</FormLabel>
              <FormControl>
                <Textarea placeholder='Velkommen til en magisk aften med Navet' {...field} />
              </FormControl>
              <FormDescription>Dette er en liten teaser av arrangementet.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <DescriptionEditor form={form} />
        <Separator />

        {/* Organizsers */}
        <Organizers form={form} />
        <Separator />

        {/* External event */}
        <FormField
          control={form.control}
          name='eventType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Arrangementtype</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger className='w-[180px]'>
                    <SelectValue placeholder='Velg arrangementtype' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='internal_event'>Internt</SelectItem>
                    <SelectItem value='external_event'>Eksternt</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isExternalEvent && (
          <FormField
            control={form.control}
            name='externalUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link til arrangementet</FormLabel>
                <FormControl>
                  <Input placeholder='f.eks. https://ifinavet.no/' {...field} />
                </FormControl>
                <FormDescription>Legg til en url til det eksterne arrangementet</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Separator />

        {/* Submit form */}
        <div className='mb-4 flex gap-4'>
          <Button
            type='submit'
            disabled={form.formState.isSubmitting}
            onClick={form.handleSubmit(onDefaultSubmitAction)}
          >
            <Send /> {form.formState.isSubmitting ? "Jobber..." : "Lagre og publiser"}
          </Button>
          <Button
            type='submit'
            disabled={form.formState.isSubmitting}
            variant='secondary'
            onClick={form.handleSubmit(onSecondarySubmitAction)}
          >
            <Save /> {form.formState.isSubmitting ? "Jobber..." : "Lagre"}
          </Button>
          {onTertiarySubmitAction && (
            <Button
              type='submit'
              disabled={form.formState.isSubmitting}
              variant='destructive'
              onClick={form.handleSubmit(onTertiarySubmitAction)}
            >
              <EyeOff /> {form.formState.isSubmitting ? "Jobber..." : "Lagre og avpubliser"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
