"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components//tabs";
import { toast } from "sonner";
import { Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@workspace/backend/convex/api";
import { Id } from "@workspace/backend/convex/dataModel";
import { humanReadableDate } from "@/uitls/dateFormatting";
import { createColumns, Registration } from "@/components/events/admin/columns";
import { RegistrationsTable } from "@/components/events/admin/registrations-table";

export function Registrations({ preloadedRegistrations }: { preloadedRegistrations: Preloaded<typeof api.registration.getByEventId>; }) {
  const registrations = usePreloadedQuery(preloadedRegistrations)

  const deleteRegistration = useMutation(api.registration.unregister)
  const handleDeleteRegistration = async (registrationId: Id<"registrations">) => {
    deleteRegistration({
      id: registrationId,
    }).then(() => {
      toast.success("Registreringen ble slettet", {
        description: humanReadableDate(new Date()),
      });
    }).catch(error => {
      toast.error("Det oppsto en feil ved sletting av registreringen", {
        description: error.name + ": " + error.message,
      });
    })
  }

  const updateRegistration = useMutation(api.registration.updateAttendance);
  const handleUpdateRegistration = async (registrationId: Id<"registrations">, newStatus: string) => {
    updateRegistration({
      id: registrationId,
      newStatus: newStatus as "confirmed" | "late" | "no_show",
    }).then(() => {
      toast.success("Registreringen ble oppdatert", {
        description: humanReadableDate(new Date()),
      });
    }).catch(error => {
      toast.error("Det oppsto en feil ved oppdatering av registreringen", {
        description: error.name + ": " + error.message,
      });
    })
  }

  const columns = createColumns(
    (registrationId) => handleDeleteRegistration(registrationId),
    (registrationId, newStatus) => handleUpdateRegistration(registrationId, newStatus),
  );

  const registeredData =
    registrations?.registered?.map(
      (registration) =>
        ({
          registrationId: registration._id,
          userName: registration.userName,
          note: registration.note,
          status: registration.status,
          registrationTime: new Date(registration.registrationTime),
          attendanceStatus: registration.attendanceStatus,
        }) as Registration,
    ) ?? [];

  const waitlistData =
    registrations.waitlist?.map(
      (registration) =>
        ({
          registrationId: registration._id,
          userName: registration.userName,
          note: registration.note,
          status: registration.status,
          registrationTime: new Date(registration.registrationTime),
          attendanceStatus: registration.attendanceStatus,
        }) as Registration,
    ) ?? [];

  return (
    <Tabs defaultValue='registered'>
      <TabsList>
        <TabsTrigger value='registered'>Påmeldte</TabsTrigger>
        <TabsTrigger value='waitlist' disabled={waitlistData.length === 0}>
          Venteliste
        </TabsTrigger>
      </TabsList>
      <TabsContent value='registered'>
        <h2 className='scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0'>
          Påmeldte
        </h2>
        <RegistrationsTable columns={columns} data={registeredData} />
      </TabsContent>

      <TabsContent value='waitlist'>
        <h2 className='scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0'>
          Venteliste
        </h2>
        <RegistrationsTable
          columns={columns}
          data={waitlistData}
          empty_message='Ingen på venteliste'
        />
      </TabsContent>
    </Tabs>
  );
}
