"use client";

import getCompanies from "@/app/(bifrost)/_queries/getCompanies";
import getInternalMembers from "@/app/(bifrost)/_queries/getInternalMembers";
import ContentEditor from "@/components/bifrost/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodv4Resolver } from "@/lib/zod-v4-resolver";
import { Separator } from "@radix-ui/react-separator";
import { useQuery } from "@tanstack/react-query";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod/v4";
import { columns } from "./_organizeers-table/columns";
import OrganizersTable from "./_organizeers-table/data-table";

export const formSchema = z.object({
  title: z.string().min(10, {
    message: "Tittelen må være minst 10 tegn",
  }),
  teaser: z
    .string()
    .min(10, {
      message: "Teaser må være minst 10 tegn",
    })
    .max(250, {
      message: "Teaser kan være maks 250 tegn",
    }),
  eventDate: z.date("Dato og tid for arrangementet er påkrevd"),
  registrationDate: z.date("Dato og tid for åpning av påmelding er påkrevd"),
  description: z.string(),
  food: z.string(),
  location: z.string(),
  ageRestrictions: z.string(),
  language: z.string(),
  participantsLimit: z
    .number("Deltakergrense er påkrevd")
    .min(0, { message: "Deltakergrense må være minst 0" }),
  eventType: z.enum(["internal_event", "external_event"]),
  hostingCompany: z.object({ name: z.string(), id: z.string() }),
  organizers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.enum(["main", "assistant"]),
    }),
  ),
  externalUrl: z.string().optional(),
});

export default function CreateEventForm({ orgId }: { orgId: string }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodv4Resolver(formSchema),
    defaultValues: {
      title: "",
      teaser: "",
      eventDate: new Date(new Date().setHours(16, 0, 0, 0)),
      registrationDate: new Date(new Date().setHours(12, 0, 0, 0)),
      description: "",
      food: "",
      location: "",
      ageRestrictions: "",
      participantsLimit: 40,
      language: "Norsk",
      eventType: "internal_event",
      hostingCompany: { name: "", id: "" },
      organizers: [],
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:float-left before:text-slate-200 before:h-0 before:pointer-events-none",
        placeholder: "Skriv en kjempe kul beskrivelse av arrangementet...",
      }),
      Underline,
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-base max-w-none sm:prose-sm m-5 focus:outline-none dark:prose-invert",
      },
    },
    onUpdate({ editor }) {
      form.setValue("description", editor.getHTML());
    },
    immediatelyRender: false,
    content: "",
  });

  const watchedEventType = form.watch("eventType");

  const [openCompanies, setOpenCompanies] = useState(false);
  const [companyValue, setCompanyValue] = useState("");
  const [organizers] = useState<
    {
      id: string;
      name: string;
      role: "main" | "assistant";
    }[]
  >([]);

  const isExternalEvent = useMemo(
    () => watchedEventType === "external_event",
    [watchedEventType],
  );

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });

  const { data: internalMembers } = useQuery({
    queryKey: ["internalMembers", orgId],
    queryFn: () => getInternalMembers(orgId),
  });

  console.log(internalMembers);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tittel</FormLabel>
              <FormControl>
                <Input
                  placeholder="Bedriftspresentasjon med Navet"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Dette er hva arrangementet skal hete.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <div className="grid md:grid-cols-2 gap-4 grid-cols-1">
          <FormField
            control={form.control}
            name="food"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mat</FormLabel>
                <FormControl>
                  <Input placeholder="Sushi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sted</FormLabel>
                <FormControl>
                  <Input placeholder="Månen" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="participantsLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deltaker grense</FormLabel>
                <FormControl>
                  <Input
                    placeholder="40"
                    type="number"
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
                    min="0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ageRestrictions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aldersbegrensninger</FormLabel>
                <FormControl>
                  <Input placeholder="18 års aldersgrense" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Språk</FormLabel>
                <FormControl>
                  <Input placeholder="Norsk" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hostingCompany"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Velg arrangerende bedrift</FormLabel>
                <Popover open={openCompanies} onOpenChange={setOpenCompanies}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-expanded={openCompanies}
                      className="w-[200px] justify-between"
                    >
                      {companyValue
                        ? companies?.find(
                            (company) => company.company_name === companyValue,
                          )?.company_name
                        : "Velg en bedrift..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Søk etter bedrift..." />
                      <CommandList>
                        <CommandEmpty>Fant ingen bedrift(er).</CommandEmpty>
                        <CommandGroup>
                          {companies?.map((company) => (
                            <CommandItem
                              key={company.company_id}
                              value={company.company_name}
                              onSelect={(currentValue) => {
                                setCompanyValue(
                                  currentValue === companyValue
                                    ? ""
                                    : currentValue,
                                );
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
              </FormItem>
            )}
          />
        </div>
        <Separator />
        <Separator />
        <FormField
          control={form.control}
          name="teaser"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teaser</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Velkommen til en magisk aften med Navet"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Dette er en liten teaser av arrangementet.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={() => (
            <FormItem className="flex flex-col">
              <FormLabel>Beskrivelse</FormLabel>
              <FormControl>
                <ContentEditor editor={editor} />
              </FormControl>
              <FormDescription>
                Dette er beskrivelsen av arrangementet.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <OrganizersTable columns={columns} data={organizers} />
        <Separator />
        <FormField
          control={form.control}
          name="eventType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Arrangementtype</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Velg arrangementtype" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal_event">Internt</SelectItem>
                    <SelectItem value="external_event">Eksternt</SelectItem>
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
            name="externalUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link til arrangementet</FormLabel>
                <FormControl>
                  <Input placeholder="https://www.navet.no" {...field} />
                </FormControl>
                <FormDescription>
                  Legg til en url til det eksterne arrangementet
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Separator />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
