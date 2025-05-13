"use client";

import DateTimePicker from "@/app/(bifrost)/bifrost/events/create-event/DateTimePicker";
import {getCompanies, getInternalMembers, submitEvent,} from "@/app/(bifrost)/bifrost/events/create-event/actions";
import ContentEditor from "@/app/(bifrost)/bifrost/events/create-event/editor";
import {Button} from "@/components/ui/button";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,} from "@/components/ui/command";
import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Separator} from "@/components/ui/separator";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "@/components/ui/table";
import {Textarea} from "@/components/ui/textarea";
import {cn} from "@/lib/utils";
import {zodResolver} from "@hookform/resolvers/zod";
import {Placeholder} from "@tiptap/extension-placeholder";
import {Underline} from "@tiptap/extension-underline";
import {useEditor} from "@tiptap/react";
import {StarterKit} from "@tiptap/starter-kit";
import {Check, ChevronsUpDown} from "lucide-react";
import React, {useEffect} from "react";
import {useForm} from "react-hook-form";
import {z} from "zod";

export const formSchema = z.object({
    title: z.string().min(10, {
        message: "Titelen må være minst 10 tegn",
    }),
    teaser: z
        .string()
        .min(10, {
            message: "Teaser må være minst 10 tegn",
        })
        .max(250, {
            message: "Teaser kan være maks 250 tegn",
        }),
    eventDate: z.date({
        required_error: "Dato og tid for arrangementet er påkrevd",
    }),
    registrationDate: z.date({
        required_error: "Dato og tid for åpning av påmelding er påkrevd",
    }),
    description: z.string(),
    food: z.string(),
    location: z.string(),
    ageRestrictions: z.string(),
    language: z.string(),
    participantsLimit: z
        .number({ required_error: "Deltakergrense er påkrevd" })
        .min(0, { message: "Deltakergrense må være minst 0" }),
    eventType: z.enum(["internal_event", "external_event"]),
    hostingCompany: z.object({ name: z.string(), id: z.string() }),
    organizers: z.array(z.object({ id: z.string(), role: z.string() })),
    externalUrl: z.string().optional(),
});

enum OrganizerType {
    Organizer = "Ansvarlig",
    MainOrganizer = "Hovedansvarlig",
}

export function CreateEventForm() {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            teaser: "",
            eventDate: (() => {
                const date = new Date();
                date.setHours(16, 0, 0, 0);
                return date;
            })(),
            registrationDate: (() => {
                const date = new Date();
                date.setHours(12, 0, 0, 0);
                return date;
            })(),
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
    const [companies, setCompanies] = React.useState<{ name: string; id: string }[]>([]);
    const [openBedrift, setOpenBedrift] = React.useState(false);
    const [valueBedrift, setValueBedrift] = React.useState("");

    const [internalMembers, setInternalMembers] = React.useState<
        {
            id: string;
            firstname: string;
            lastname: string;
            fullname: string;
        }[]
    >([]);
    const [selectedOrganizers, setSelectedOrganizers] = React.useState<
        {
            type: keyof typeof OrganizerType;
            organizer: {
                id: string;
                firstname: string;
                lastname: string;
                fullname: string;
            };
        }[]
    >([]);

    const [openMember, setOpenMember] = React.useState(false);
    const [valueMember, setValueMember] = React.useState("");
    const [selectedOrganizerType, setSelectedOrganizerType] =
        React.useState<keyof typeof OrganizerType>("Organizer");
    const [eventType, setEventType] = React.useState("internal_event");
    function onSubmit(values: z.infer<typeof formSchema>) {
        console.log(values);
        submitEvent(values);
    }

    useEffect(() => {
        async function fetchCompanies() {
            const companies = await getCompanies();
            setCompanies(companies);
        }

        async function fetchInternalMembers() {
            const members = await getInternalMembers();
            setInternalMembers(members);
        }

        fetchCompanies();
        fetchInternalMembers();
    }, []);

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
                class: "prose prose-sm prose-base sm:prose-sm m-5 focus:outline-none dark:text-white",
            },
        },
        onUpdate({ editor }) {
            form.setValue("description", editor.getHTML());
        },
        immediatelyRender: false,
        content: "",
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
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
                <div className='grid md:grid-cols-2 gap-4 grid-cols-1'>
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
                                                field.onChange(
                                                    Number.isNaN(numValue) ? 0 : numValue,
                                                );
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
                                <Popover open={openBedrift} onOpenChange={setOpenBedrift}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant='outline'
                                            aria-expanded={openBedrift}
                                            className='w-[200px] justify-between'
                                        >
                                            {valueBedrift
                                                ? companies.find(
                                                      (company) => company.name === valueBedrift,
                                                  )?.name
                                                : "Velg en bedrift..."}
                                            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-[200px] p-0'>
                                        <Command>
                                            <CommandInput placeholder='Søk etter bedrift...' />
                                            <CommandList>
                                                <CommandEmpty>Fant ingen bedrift(er).</CommandEmpty>
                                                <CommandGroup>
                                                    {companies.map((company) => (
                                                        <CommandItem
                                                            key={company.id}
                                                            value={company.name}
                                                            onSelect={(currentValue) => {
                                                                setValueBedrift(
                                                                    currentValue === valueBedrift
                                                                        ? ""
                                                                        : currentValue,
                                                                );
                                                                field.onChange(company);
                                                                setOpenBedrift(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    valueBedrift === company.name
                                                                        ? "opacity-100"
                                                                        : "opacity-0",
                                                                )}
                                                            />
                                                            {company.name}
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
                <div className='grid sm:grid-cols-2 gap-4'>
                    <DateTimePicker
                        form={form}
                        formField='eventDate'
                        label='Velg dato og tid for arrangementet'
                    />
                    <DateTimePicker
                        form={form}
                        formField='registrationDate'
                        label='Velg dato of tid for åpning av påmeldingen av arrangementet'
                    />
                </div>
                <Separator />
                <FormField
                    control={form.control}
                    name='teaser'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Teaser</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder='Velkommen til en magisk aften med Navet'
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
                    name='description'
                    render={() => (
                        <FormItem className='flex flex-col'>
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
                <div className='flex flex-col gap-4'>
                    <div className='flex gap-4 flex-wrap'>
                        <Button
                            type='button'
                            onClick={() => {
                                if (!valueMember && !selectedOrganizerType) return;

                                const organizerToAdd = internalMembers.find(
                                    (internalMember) => internalMember.fullname === valueMember,
                                );

                                if (organizerToAdd) {
                                    setSelectedOrganizers([
                                        ...selectedOrganizers,
                                        {
                                            type: selectedOrganizerType || "organizer",
                                            organizer: organizerToAdd,
                                        },
                                    ]);

                                    const currentOrganizers = form.getValues("organizers");
                                    if (
                                        !currentOrganizers.includes({
                                            id: organizerToAdd.id,
                                            role: selectedOrganizerType,
                                        })
                                    ) {
                                        form.setValue("organizers", [
                                            ...currentOrganizers,
                                            { id: organizerToAdd.id, role: selectedOrganizerType },
                                        ]);
                                    }

                                    setValueMember("");
                                    setSelectedOrganizerType("Organizer");
                                }
                            }}
                        >
                            Legg til ansvarlig
                        </Button>
                        <Popover open={openMember} onOpenChange={setOpenMember}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant='outline'
                                    aria-expanded={openMember}
                                    className='w-[200px] justify-between'
                                >
                                    {valueMember
                                        ? internalMembers.find(
                                              (internalMember) =>
                                                  internalMember.fullname === valueMember,
                                          )?.fullname
                                        : "Velg et medlem..."}
                                    <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className='w-[200px] p-0'>
                                <Command>
                                    <CommandInput placeholder='Søk etter et medlem...' />
                                    <CommandList>
                                        <CommandEmpty>Fant ingen ansvarlige(er).</CommandEmpty>
                                        <CommandGroup>
                                            {internalMembers.map((internalMember) => (
                                                <CommandItem
                                                    key={internalMember.id}
                                                    value={internalMember.fullname}
                                                    onSelect={(currentValue) => {
                                                        setValueMember(
                                                            currentValue === valueMember
                                                                ? ""
                                                                : currentValue,
                                                        );
                                                        setOpenMember(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            valueMember === internalMember.fullname
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
                                setSelectedOrganizerType(value as keyof typeof OrganizerType);
                            }}
                            defaultValue={selectedOrganizerType}
                        >
                            <SelectTrigger className='w-[180px]'>
                                <SelectValue placeholder='Ansvarlig type' />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(OrganizerType).map(([key, value]) => (
                                    <SelectItem key={key} value={key}>
                                        {value}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn på ansvarlig</TableHead>
                                <TableHead>Type</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedOrganizers.map((organizer, index) => (
                                <TableRow key={`${index}-${organizer.organizer.id}`}>
                                    <TableCell className='font-medium'>
                                        {organizer.organizer.fullname}
                                    </TableCell>
                                    <TableCell>{OrganizerType[organizer.type]}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <Separator />
                <FormField
                    control={form.control}
                    name='eventType'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Arrangementstype</FormLabel>
                            <FormControl>
                                <Select
                                    onValueChange={(value: string) => {
                                        field.onChange(value);
                                        setEventType(value);
                                    }}
                                    defaultValue={field.value}
                                >
                                    <SelectTrigger className='w-[180px]'>
                                        <SelectValue placeholder='Velg arrangementstype' />
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
                {eventType === "external_event" && (
                    <FormField
                        control={form.control}
                        name='externalUrl'
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Link til arrangementet</FormLabel>
                                <FormControl>
                                    <Input placeholder='https://www.navet.no' {...field} />
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
                <Button type='submit'>Submit</Button>
            </form>
        </Form>
    );
}
