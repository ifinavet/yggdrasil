"use client";

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
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import getInternalMembers from "@/lib/queries/bifrost/getInternalMembers";
import { cn } from "@/lib/utils";
import { OrganizerType } from "@/shared/enums";
import type { EventFormValues } from "@/utils/bifrost/schemas/event-form-schema";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { createColumns } from "./columns";
import OrganizersTable from "./data-table";

export default function Organizers({
  form,
}: {
  form: UseFormReturn<EventFormValues>;
}) {
  const { orgId, isLoaded } = useAuth();

  const { data: internalMembers } = useQuery({
    queryKey: ["internalMembers", orgId],
    queryFn: () => getInternalMembers(orgId as string),
    enabled: isLoaded && !!orgId,
  });

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
  >(
    form.watch("organizers").map((organizer) => ({
      id: organizer.id,
      name:
        internalMembers?.find((member) => member.id === organizer.id)
          ?.fullname || "Ukjent",
      role: organizer.role,
    })),
  );

  if (!isLoaded) return <div>Loading...</div>;
  if (!orgId) throw new Error("User is not logged in");

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

  return (
    <FormField
      control={form.control}
      name="organizers"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Arrangtører</FormLabel>
          <FormControl>
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <Popover open={openMembers} onOpenChange={setOpenMembers}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-expanded={openMembers}
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
                        <CommandEmpty>Fant ingen ansvarlige(er).</CommandEmpty>
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
              <OrganizersTable columns={columns} data={selectedOrganizers} />
            </div>
          </FormControl>
          <FormDescription>
            Velg hvem som skal planlegge og arrangere arrangementet.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
