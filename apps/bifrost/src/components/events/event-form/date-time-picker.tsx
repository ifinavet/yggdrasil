import { Button } from "@workspace/ui/components//button";
import { Calendar } from "@workspace/ui/components//calendar";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components//form";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components//popover";
import { ScrollArea, ScrollBar } from "@workspace/ui/components//scroll-area";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { cn } from "@/utils/utils";

export default function DateTimePicker({
  form,
  formField,
  label,
  description,
}: {
  form: UseFormReturn<{
    eventDate: Date;
    title: string;
    description: string;
    food: string;
    location: string;
    organizers: { id: string; role: "main" | "assistant" }[];
    teaser: string;
    registrationDate: Date;
    ageRestrictions: string;
    language: string;
    participantsLimit: number;
    eventType: "internal_event" | "external_event";
    hostingCompany: { company_name: string; company_id: number };
    externalUrl?: string;
  }>;
  formField: "eventDate" | "registrationDate";
  label: string;
  description: string;
}) {
  function handleDateSelectEventDate(date: Date | undefined) {
    const currentDate = form.getValues(formField) || new Date();
    const newDate = date;

    if (newDate) {
      newDate.setHours(currentDate.getHours());
      newDate.setMinutes(currentDate.getMinutes());
      form.setValue(formField, newDate);
    }
  }
  function handleTimeChangeEventDate(type: "hour" | "minute", value: string) {
    const currentDate = form.getValues(formField) || new Date();
    const newDate = new Date(currentDate);

    if (type === "hour") {
      const hour = Number.parseInt(value, 10);
      newDate.setHours(hour);
    } else if (type === "minute") {
      newDate.setMinutes(Number.parseInt(value, 10));
    }

    form.setValue(formField, newDate);
  }

  return (
    <FormField
      control={form.control}
      name={formField}
      render={({ field }) => (
        <FormItem className='flex flex-col'>
          <FormLabel>{label}</FormLabel>
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
                  ISOWeek={true}
                  locale={nb}
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
                              field.value && field.value.getHours() === hour ? "default" : "ghost"
                            }
                            className='sm:w-full shrink-0 aspect-square'
                            onClick={() => handleTimeChangeEventDate("hour", hour.toString())}
                          >
                            {hour}
                          </Button>
                        ))}
                    </div>
                    <ScrollBar orientation='horizontal' className='sm:hidden' />
                  </ScrollArea>
                  <ScrollArea className='w-64 sm:w-auto'>
                    <div className='flex sm:flex-col p-2'>
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                        <Button
                          key={minute}
                          size='icon'
                          variant={
                            field.value && field.value.getMinutes() === minute ? "default" : "ghost"
                          }
                          className='sm:w-full shrink-0 aspect-square'
                          onClick={() => handleTimeChangeEventDate("minute", minute.toString())}
                        >
                          {minute.toString().padStart(2, "0")}
                        </Button>
                      ))}
                    </div>
                    <ScrollBar orientation='horizontal' className='sm:hidden' />
                  </ScrollArea>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
