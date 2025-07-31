"use client";

import { useAuth } from "@clerk/nextjs";
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
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components//form";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components//popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components//select";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { EventFormValues } from "@/constants/schemas/event-form-schema";
import type { OrganizerRole } from "@/constants/types";
import { getAllInternalMembers } from "@/lib/queries/organization";
import { createColumns } from "./columns";
import OrganizersTable from "./data-table";

export default function Organizers({ form }: { form: UseFormReturn<EventFormValues> }) {
  const { orgId, isLoaded } = useAuth();

  const { data: internalMembers } = useQuery({
    queryKey: ["internalMembers", orgId],
    queryFn: () => getAllInternalMembers(orgId as string),
    enabled: isLoaded && !!orgId,
  });

  const [openMembers, setOpenMembers] = useState(false);
  const selectedMember = useRef("");

  const [selectedOrganizerType, setSelectedOrganizerType] = useState<OrganizerRole>(
    "medhjelper",
  );

  const selectedOrganizers = useMemo(() => {
    if (!internalMembers) return [];

    return form.watch("organizers").map((organizer) => ({
      id: organizer.id,
      name: internalMembers.find((member) => member.id === organizer.id)?.fullname || "Ukjent",
      role: organizer.role,
    }));
  }, [internalMembers, form.watch("organizers")]);

  if (!isLoaded) return <div>Loading...</div>;
  if (!orgId) throw new Error("User is not logged in");
  if (!internalMembers) return <div>Loading members...</div>;

  const handleRoleChange = (organizerId: string, newRole: OrganizerRole) => {
    const currentOrganizers = form.getValues("organizers");
    const updatedOrganizers = currentOrganizers.map((organizer) =>
      organizer.id === organizerId ? { ...organizer, role: newRole } : organizer,
    );
    form.setValue("organizers", updatedOrganizers);
  };

  const handleDeleteOrganizer = (organizerId: string) => {
    const currentOrganizers = form.getValues("organizers");
    const updatedOrganizers = currentOrganizers.filter((organizer) => organizer.id !== organizerId);
    form.setValue("organizers", updatedOrganizers);
  };

  const columns = createColumns(handleRoleChange, handleDeleteOrganizer);

  return (
    <FormField
      control={form.control}
      name='organizers'
      render={({ field }) => (
        <FormItem className='flex flex-col'>
          <FormLabel>Ansvarlige</FormLabel>
          <FormControl>
            <div className='flex flex-col gap-4'>
              <div className='flex gap-4'>
                <Popover open={openMembers} onOpenChange={setOpenMembers}>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      aria-expanded={openMembers}
                      className='w-[200px] justify-between'
                    >
                      {selectedMember.current
                        ? internalMembers.find(
                          (internalMember) => internalMember.fullname === selectedMember.current,
                        )?.fullname
                        : "Velg et medlem..."}
                      <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-[200px] p-0'>
                    <Command>
                      <CommandInput placeholder='Søk etter en ansvarlig...' />
                      <CommandList>
                        <CommandEmpty>Fant ingen ansvarlige(er).</CommandEmpty>
                        <CommandGroup>
                          {internalMembers.map((internalMember) => (
                            <CommandItem
                              key={internalMember.id}
                              value={internalMember.fullname ?? "Ukjent"}
                              onSelect={(currentValue) => {
                                selectedMember.current =
                                  currentValue === selectedMember.current ? "" : currentValue;
                                setOpenMembers(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedMember.current === internalMember.fullname
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
                    setSelectedOrganizerType(value as OrganizerRole);
                  }}
                  value={selectedOrganizerType}
                >
                  <SelectTrigger className='w-[180px]'>
                    <SelectValue placeholder='Ansvarlig type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='medhjelper'>Medhjelper</SelectItem>
                    <SelectItem value='hovedansvarlig'>Hovedansvarlig</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type='button'
                  onClick={() => {
                    if (!selectedMember.current) return;

                    const organizerToAdd = internalMembers.find(
                      (internalMember) => internalMember.fullname === selectedMember.current,
                    );

                    if (organizerToAdd) {
                      // Check if organizer is already added
                      const currentOrganizers = field.value;
                      const isAlreadyAdded = currentOrganizers.some(
                        (organizer) => organizer.id === organizerToAdd.id
                      );

                      if (!isAlreadyAdded) {
                        field.onChange([
                          ...currentOrganizers,
                          {
                            id: organizerToAdd.id,
                            role: selectedOrganizerType || "medhjelper",
                          },
                        ]);
                      }

                      selectedMember.current = "";
                      setSelectedOrganizerType("medhjelper");
                    }
                  }}
                >
                  Legg til ansvarlig
                </Button>
              </div>
              <OrganizersTable columns={columns} data={selectedOrganizers} />
            </div>
          </FormControl>
          <FormDescription>
            Velg hvem som er ansvarlig for og skal organisere/planlegge arrangementet.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
