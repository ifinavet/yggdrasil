"use client";

import {getCompanies} from "@/app/dashboard/events/create-event/actions";
import ContentEditor from "@/app/dashboard/events/create-event/editor";
import {Button} from "@/components/ui/button";
import {Calendar} from "@/components/ui/calendar";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,} from "@/components/ui/command";
import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {ScrollArea, ScrollBar} from "@/components/ui/scroll-area";
import {Separator} from "@/components/ui/separator";
import {Textarea} from "@/components/ui/textarea";
import {cn} from "@/lib/utils";
import {zodResolver} from "@hookform/resolvers/zod";
import {Placeholder} from "@tiptap/extension-placeholder";
import {Underline} from "@tiptap/extension-underline";
import {useEditor} from "@tiptap/react";
import {StarterKit} from "@tiptap/starter-kit";
import {format} from "date-fns";
import {CalendarIcon, Check, ChevronsUpDown} from "lucide-react";
import React, {useEffect} from "react";
import {useForm} from "react-hook-form";
import {z} from "zod";

const formSchema = z.object({
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
        .min(1, { message: "Deltakergrense må være minst 1" }),
    eventType: z.enum(["internal_event", "external_event"]),
    hostingCompany: z.object({ name: z.string(), id: z.string() }),
    organizers: z.array(z.string()),
});

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
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState("");
    function onSubmit(values: z.infer<typeof formSchema>) {
        console.log(values);
    }

    useEffect(() => {
        async function fetchCompanies() {
            const companies = await getCompanies();
            setCompanies(companies);
        }

        fetchCompanies();
    }, []);

    function handleDateSelectEventDate(date: Date | undefined) {
        if (date) {
            form.setValue("eventDate", date);
        }
    }

    function handleTimeChangeEventDate(type: "hour" | "minute", value: string) {
        const currentDate = form.getValues("eventDate") || new Date();
        const newDate = new Date(currentDate);

        if (type === "hour") {
            const hour = Number.parseInt(value, 10);
            newDate.setHours(hour);
        } else if (type === "minute") {
            newDate.setMinutes(Number.parseInt(value, 10));
        }

        form.setValue("eventDate", newDate);
    }

    function handleDateSelectRegistrationDate(date: Date | undefined) {
        if (date) {
            form.setValue("registrationDate", date);
        }
    }

    function handleTimeChangeRegistrationDate(type: "hour" | "minute", value: string) {
        const currentDate = form.getValues("registrationDate") || new Date();
        const newDate = new Date(currentDate);

        if (type === "hour") {
            const hour = Number.parseInt(value, 10);
            newDate.setHours(hour);
        } else if (type === "minute") {
            newDate.setMinutes(Number.parseInt(value, 10));
        }

        form.setValue("registrationDate", newDate);
    }

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
                class: "prose prose-sm prose-base sm:prose-sm m-5 focus:outline-none",
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
                                    <Input placeholder='40' {...field} type='number' />
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
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant='outline'
                                            aria-expanded={open}
                                            className='w-[200px] justify-between'
                                        >
                                            {value
                                                ? companies.find(
                                                      (company) => company.name === value,
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
                                                                setValue(
                                                                    currentValue === value
                                                                        ? ""
                                                                        : currentValue,
                                                                );
                                                                setOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    value === company.name
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
                    <FormField
                        control={form.control}
                        name='eventDate'
                        render={({ field }) => (
                            <FormItem className='flex flex-col'>
                                <FormLabel>Velg dato og tid for arrangementet</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground",
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "MM/dd/yyyy HH:mm")
                                                ) : (
                                                    <span>MM/DD/YYYY HH:mm</span>
                                                )}
                                                <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-auto p-0'>
                                        <div className='sm:flex'>
                                            <Calendar
                                                mode='single'
                                                selected={field.value}
                                                onSelect={handleDateSelectEventDate}
                                                initialFocus
                                            />
                                            <div className='flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x'>
                                                <ScrollArea className='w-64 sm:w-auto'>
                                                    <div className='flex sm:flex-col p-2'>
                                                        {Array.from({ length: 24 }, (_, i) => i)
                                                            .reverse()
                                                            .map((hour) => (
                                                                <Button
                                                                    key={hour}
                                                                    size='icon'
                                                                    variant={
                                                                        field.value &&
                                                                        field.value.getHours() ===
                                                                            hour
                                                                            ? "default"
                                                                            : "ghost"
                                                                    }
                                                                    className='sm:w-full shrink-0 aspect-square'
                                                                    onClick={() =>
                                                                        handleTimeChangeEventDate(
                                                                            "hour",
                                                                            hour.toString(),
                                                                        )
                                                                    }
                                                                >
                                                                    {hour}
                                                                </Button>
                                                            ))}
                                                    </div>
                                                    <ScrollBar
                                                        orientation='horizontal'
                                                        className='sm:hidden'
                                                    />
                                                </ScrollArea>
                                                <ScrollArea className='w-64 sm:w-auto'>
                                                    <div className='flex sm:flex-col p-2'>
                                                        {Array.from(
                                                            { length: 12 },
                                                            (_, i) => i * 5,
                                                        ).map((minute) => (
                                                            <Button
                                                                key={minute}
                                                                size='icon'
                                                                variant={
                                                                    field.value &&
                                                                    field.value.getMinutes() ===
                                                                        minute
                                                                        ? "default"
                                                                        : "ghost"
                                                                }
                                                                className='sm:w-full shrink-0 aspect-square'
                                                                onClick={() =>
                                                                    handleTimeChangeEventDate(
                                                                        "minute",
                                                                        minute.toString(),
                                                                    )
                                                                }
                                                            >
                                                                {minute.toString().padStart(2, "0")}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <ScrollBar
                                                        orientation='horizontal'
                                                        className='sm:hidden'
                                                    />
                                                </ScrollArea>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <FormDescription>
                                    Velg nå arrangementet skal begynne.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name='registrationDate'
                        render={({ field }) => (
                            <FormItem className='flex flex-col'>
                                <FormLabel>Velg dato og tid for åpning av påmelding</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground",
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "MM/dd/yyyy HH:mm")
                                                ) : (
                                                    <span>MM/DD/YYYY HH:mm</span>
                                                )}
                                                <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-auto p-0'>
                                        <div className='sm:flex'>
                                            <Calendar
                                                mode='single'
                                                selected={field.value}
                                                onSelect={handleDateSelectRegistrationDate}
                                                initialFocus
                                            />
                                            <div className='flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x'>
                                                <ScrollArea className='w-64 sm:w-auto'>
                                                    <div className='flex sm:flex-col p-2'>
                                                        {Array.from({ length: 24 }, (_, i) => i)
                                                            .reverse()
                                                            .map((hour) => (
                                                                <Button
                                                                    key={hour}
                                                                    size='icon'
                                                                    variant={
                                                                        field.value &&
                                                                        field.value.getHours() ===
                                                                            hour
                                                                            ? "default"
                                                                            : "ghost"
                                                                    }
                                                                    className='sm:w-full shrink-0 aspect-square'
                                                                    onClick={() =>
                                                                        handleTimeChangeRegistrationDate(
                                                                            "hour",
                                                                            hour.toString(),
                                                                        )
                                                                    }
                                                                >
                                                                    {hour}
                                                                </Button>
                                                            ))}
                                                    </div>
                                                    <ScrollBar
                                                        orientation='horizontal'
                                                        className='sm:hidden'
                                                    />
                                                </ScrollArea>
                                                <ScrollArea className='w-64 sm:w-auto'>
                                                    <div className='flex sm:flex-col p-2'>
                                                        {Array.from(
                                                            { length: 12 },
                                                            (_, i) => i * 5,
                                                        ).map((minute) => (
                                                            <Button
                                                                key={minute}
                                                                size='icon'
                                                                variant={
                                                                    field.value &&
                                                                    field.value.getMinutes() ===
                                                                        minute
                                                                        ? "default"
                                                                        : "ghost"
                                                                }
                                                                className='sm:w-full shrink-0 aspect-square'
                                                                onClick={() =>
                                                                    handleTimeChangeRegistrationDate(
                                                                        "minute",
                                                                        minute.toString(),
                                                                    )
                                                                }
                                                            >
                                                                {minute.toString().padStart(2, "0")}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <ScrollBar
                                                        orientation='horizontal'
                                                        className='sm:hidden'
                                                    />
                                                </ScrollArea>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <FormDescription>
                                    Velg når påmeldingen åpner for arrangementet.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
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
                    render={({ field }) => (
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
                <Button type='submit'>Submit</Button>
            </form>
        </Form>
    );
}
