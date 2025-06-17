"use client";

import { createColumns } from "@/components/bifrost/columns";
import OrganizersTable from "@/components/bifrost/data-table";
import DateTimePicker from "@/components/bifrost/date-time-picker";
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
import createEvent from "@/lib/queries/bifrost/createEvent";
import getCompanies from "@/lib/queries/bifrost/getCompanies";
import getEvent from "@/lib/queries/bifrost/getEvent";
import getInternalMembers from "@/lib/queries/bifrost/getInternalMembers";
import { cn } from "@/lib/utils";
import { zodv4Resolver } from "@/lib/zod-v4-resolver";
import { OrganizerType } from "@/shared/enums";
import {
  EventFormValues,
  formSchema,
} from "@/utils/bifrost/schemas/event-form-schema";
import { Separator } from "@radix-ui/react-separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function UpdateEventForm({
  event_id,
  orgId,
}: {
  event_id: number;
  orgId: string;
}) {
  const {
    isPending,
    error,
    data: event,
  } = useQuery({
    queryKey: ["event", event_id],
    queryFn: () => getEvent(event_id),
    staleTime: Infinity,
    enabled: !!orgId,
  });

  if (isPending || !event) {
    return <div>Loading...</div>;
  }

  if (error) {
    toast.error("Failed to load event");
    return <div>Error</div>;
  }

  const form = useForm<EventFormValues>({
    resolver: zodv4Resolver(formSchema),
    defaultValues: {
      title: event.title,
      teaser: event.teaser || "",
      eventDate: new Date(event.event_start),
      registrationDate: new Date(event.registration_opens),
      description: event.description || "",
      food: event.food || "",
      location: event.location || "",
      ageRestrictions: event.age_restrictions || "",
      language: event.language,
      participantsLimit: event.participants_limit,
      organizers: [],
      eventType: event.external_url ? "external_event" : "internal_event",
      hostingCompany: event.companies,
      externalUrl: event.external_url || "",
    },
  });

  const handleEditorUpdate = useCallback(
    ({ editor }: { editor: { getHTML: () => string } }) => {
      form.setValue("description", editor.getHTML());
    },
    [form],
  );

  const handleEditorCreate = useCallback(
    ({ editor }: { editor: { getHTML: () => string } }) => {
      form.setValue("description", editor.getHTML());
    },
    [form],
  );

  const editorExtensions = useMemo(
    () => [
      StarterKit,
      Placeholder.configure({
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:float-left before:text-slate-200 before:h-0 before:pointer-events-none",
        placeholder: "Skriv en kjempe kul beskrivelse av arrangementet...",
      }),
      Underline,
    ],
    [],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class:
          "prose prose-sm prose-base max-w-none sm:prose-sm m-5 focus:outline-none dark:prose-invert",
      },
    }),
    [],
  );

  const editor = useEditor({
    extensions: editorExtensions,
    editorProps: editorProps,
    onUpdate: handleEditorUpdate,
    immediatelyRender: false,
    content: "",
    onCreate: handleEditorCreate,
  });

  const watchedEventType = form.watch("eventType");

  const [openCompanies, setOpenCompanies] = useState(false);
  const [companyValue, setCompanyValue] = useState("");

  const [openMembers, setOpenMembers] = useState(false);
  const selectedMember = useRef("");

  const [selectedOrganizerType, setSelectedOrganizerType] = useState<
    "main" | "assistant"
  >("assistant");

  const [selectedOrganizers, setSelectedOrganizers] = useState<
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

  const handleRoleChange = (
    organizerId: string,
    newRole: keyof typeof OrganizerType,
  ) => {
    // Update selectedOrganizers state
    setSelectedOrganizers((prev) =>
      prev.map((organizer) =>
        organizer.id === organizerId
          ? { ...organizer, role: newRole }
          : organizer,
      ),
    );

    // Update form field
    const currentOrganizers = form.getValues("organizers");
    const updatedOrganizers = currentOrganizers.map((organizer) =>
      organizer.id === organizerId
        ? { ...organizer, role: newRole }
        : organizer,
    );
    form.setValue("organizers", updatedOrganizers);
  };

  const handleDeleteOrganizer = (organizerId: string) => {
    // Remove from selectedOrganizers state
    setSelectedOrganizers((prev) =>
      prev.filter((organizer) => organizer.id !== organizerId),
    );

    // Remove from form field
    const currentOrganizers = form.getValues("organizers");
    const updatedOrganizers = currentOrganizers.filter(
      (organizer) => organizer.id !== organizerId,
    );
    form.setValue("organizers", updatedOrganizers);
  };

  const columns = createColumns(handleRoleChange, handleDeleteOrganizer);

  const router = useRouter();
  const { mutate } = useMutation({
    mutationFn: (values: EventFormValues) => createEvent(values),
    onSuccess: () => {
      toast.success("Arrangementet ble opprettet!", {
        description: `Arrangement opprettet, ${new Date().toLocaleDateString()}`,
      });
      router.push("/bifrost/events");
    },
    onError: (error) => {
      console.error(error);
      console.error("Noe gikk galt!");
      toast.error("Noe gikk galt!", {
        description: error.message,
      });
    },
  });

  const onSubmit = async (values: EventFormValues) => {
    mutate(values);
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Separator />
        <div className="grid sm:grid-cols-2 gap-4">
          <DateTimePicker
            form={form}
            formField="eventDate"
            label="Dato og tid for arrangements start"
            description="Velg dato og tid for når arrangementet starter"
          />
          <DateTimePicker
            form={form}
            formField="registrationDate"
            label="Dato og til for påmelding"
            description="Velg dato og tid for åpning av påmeldingen av arrangementet"
          />
        </div>
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
        <FormField
          control={form.control}
          name="organizers"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Arrangtører</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 flex-wrap">
                    <Popover open={openMembers} onOpenChange={setOpenMembers}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          aria-expanded={openCompanies}
                          className="w-[200px] justify-between"
                        >
                          {selectedMember.current
                            ? internalMembers?.find(
                                (internalMember) =>
                                  internalMember.fullname ===
                                  selectedMember.current,
                              )?.fullname
                            : "Velg et medlem..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Søk etter et medlem..." />
                          <CommandList>
                            <CommandEmpty>
                              Fant ingen ansvarlige(er).
                            </CommandEmpty>
                            <CommandGroup>
                              {internalMembers?.map((internalMember) => (
                                <CommandItem
                                  key={internalMember.id}
                                  value={internalMember.fullname ?? "Ukjent"}
                                  onSelect={(currentValue) => {
                                    selectedMember.current =
                                      currentValue === selectedMember.current
                                        ? ""
                                        : currentValue;
                                    setOpenMembers(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedMember.current ===
                                        internalMember.fullname
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {internalMember.fullname}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Select
                      onValueChange={(value: string) => {
                        setSelectedOrganizerType(
                          value as keyof typeof OrganizerType,
                        );
                      }}
                      value={selectedOrganizerType}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Ansvarlig type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(OrganizerType).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!selectedMember && !selectedOrganizers) return;

                        const organizerToAdd = internalMembers?.find(
                          (internalMember) =>
                            internalMember.fullname === selectedMember.current,
                        );

                        if (organizerToAdd) {
                          setSelectedOrganizers([
                            ...selectedOrganizers,
                            {
                              id: organizerToAdd.id,
                              name: organizerToAdd.fullname ?? "ukjent",
                              role: selectedOrganizerType || "assistant",
                            },
                          ]);

                          const currentOrganizers = field.value;
                          if (
                            !currentOrganizers.includes({
                              id: organizerToAdd.id,
                              role: selectedOrganizerType || "assistant",
                            })
                          ) {
                            field.onChange({
                              target: {
                                name: "organizers",
                                value: [
                                  ...currentOrganizers,
                                  {
                                    id: organizerToAdd.id,
                                    role: selectedOrganizerType || "assistant",
                                  },
                                ],
                              },
                            });
                          }

                          selectedMember.current = "";
                          setSelectedOrganizerType("assistant");
                        }
                      }}
                    >
                      Legg til ansvarlig
                    </Button>
                  </div>
                  <OrganizersTable
                    columns={columns}
                    data={selectedOrganizers}
                  />
                </div>
              </FormControl>
              <FormDescription>
                Velg hvem som skal planlegge og arrangere arrangementet.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </Form>
  );
}
