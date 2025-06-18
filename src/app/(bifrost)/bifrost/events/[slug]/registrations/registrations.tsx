"use client";

import {
  createColumns,
  Registration,
} from "@/components/bifrost/attendees/columns";
import { RegistrationsTable } from "@/components/bifrost/attendees/registrations-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import getRegistrations, {
  deleteRegistration,
  updateRegistration,
} from "@/lib/queries/bifrost/registrations";
import { humanReadableDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function Registrations({ event_id }: { event_id: number }) {
  const queryClient = useQueryClient();

  const { data: registrations } = useQuery({
    queryKey: ["registrations", event_id],
    queryFn: () => getRegistrations(event_id),
  });

  const { mutate: deleteRegistrationMutation } = useMutation({
    mutationFn: (user_id: string) => deleteRegistration(event_id, user_id),
    onMutate: async (user_id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["registrations", event_id],
      });

      // Snapshot the previous value
      const previousRegistrations = queryClient.getQueryData([
        "registrations",
        event_id,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(["registrations", event_id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          registered:
            old.registered?.filter((reg: any) => reg.user_id !== user_id) || [],
          waitlist:
            old.waitlist?.filter((reg: any) => reg.user_id !== user_id) || [],
        };
      });

      return { previousRegistrations };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousRegistrations) {
        queryClient.setQueryData(
          ["registrations", event_id],
          context.previousRegistrations,
        );
      }
      toast.error("Det oppsto en feil ved sletting av registreringen", {
        description: error.name + ": " + error.message,
      });
    },
    onSuccess: () => {
      toast.success("Registreringen ble slettet", {
        description: humanReadableDate(new Date()),
      });
    },
  });

  const { mutate: updateRegistrationMutation } = useMutation({
    mutationFn: ({
      user_id,
      new_status,
    }: {
      user_id: string;
      new_status: string;
    }) => updateRegistration(event_id, user_id, new_status),
    onMutate: async ({ user_id, new_status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["registrations", event_id],
      });

      // Snapshot the previous value
      const previousRegistrations = queryClient.getQueryData([
        "registrations",
        event_id,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(["registrations", event_id], (old: any) => {
        if (!old) return old;

        const updateRegistration = (regs: any[]) =>
          regs?.map((reg: any) =>
            reg.user_id === user_id
              ? { ...reg, attendance_status: new_status }
              : reg,
          ) || [];

        return {
          ...old,
          registered: updateRegistration(old.registered),
          waitlist: updateRegistration(old.waitlist),
        };
      });

      return { previousRegistrations };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousRegistrations) {
        queryClient.setQueryData(
          ["registrations", event_id],
          context.previousRegistrations,
        );
      }
      toast.error("Det oppsto en feil ved oppdatering av registreringen", {
        description: error.name + ": " + error.message,
      });
    },
    onSuccess: () => {
      toast.success("Registreringen ble oppdatert", {
        description: humanReadableDate(new Date()),
      });
    },
  });

  const columns = createColumns(
    (user_id) => deleteRegistrationMutation(user_id),
    (user_id, new_status) =>
      updateRegistrationMutation({ user_id, new_status }),
  );

  const registeredData =
    registrations?.registered?.map(
      (registration) =>
        ({
          user_id: registration.user_id,
          user_name: registration.name,
          note: registration.note,
          registration_time: new Date(registration.registration_time || ""),
          attendance_status: registration.attendance_status,
        }) as Registration,
    ) ?? [];

  const waitlistData =
    registrations?.waitlist?.map(
      (registration) =>
        ({
          user_id: registration.user_id,
          user_name: registration.name,
          note: registration.note,
          registration_time: new Date(registration.registration_time || ""),
          attendance_status: registration.attendance_status,
        }) as Registration,
    ) ?? [];

  return (
    <Tabs defaultValue="registered">
      <TabsList>
        <TabsTrigger value="registered">Påmeldte</TabsTrigger>
        <TabsTrigger value="waitlist" disabled={waitlistData.length === 0}>
          Venteliste
        </TabsTrigger>
      </TabsList>
      <TabsContent value="registered">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0">
          Påmeldte
        </h2>
        <RegistrationsTable columns={columns} data={registeredData} />
      </TabsContent>

      <TabsContent value="waitlist">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0">
          Venteliste
        </h2>
        <RegistrationsTable
          columns={columns}
          data={waitlistData}
          empty_message="Ingen på venteliste"
        />
      </TabsContent>
    </Tabs>
  );
}
