"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components//tabs";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { Copy, Mails } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import QRScannerDialog from "@/components/events/registration-scanner/qr-scanner-dialog";
import { createColumns, type Registration } from "@/components/events/registrations/columns";
import { RegistrationsTable } from "@/components/events/registrations/registrations-table";
import { humanReadableDate } from "@/utils/utils";

export function Registrations({
	preloadedRegistrations,
}: {
	preloadedRegistrations: Preloaded<typeof api.registration.getByEventId>;
}) {
	const registrations = usePreloadedQuery(preloadedRegistrations);

	const posthog = usePostHog();

	const deleteRegistration = useMutation(api.registration.unregister);
	const handleDeleteRegistration = async (registrationId: Id<"registrations">) => {
		deleteRegistration({
			id: registrationId,
		})
			.then(({ deletedRegistration }) => {
				toast.success("Registreringen ble slettet", {
					description: humanReadableDate(new Date()),
				});

				posthog.capture("bifrost-registration_deleted", {
					...deletedRegistration,
				});
			})
			.catch((error) => {
				toast.error("Det oppsto en feil ved sletting av registreringen", {
					description: `${error.name}: ${error.message}`,
				});

				posthog.captureException("bifrost-registration_delete_error", {
					site: "bifrost",
					error,
					registrationId,
				});
			});
	};

	const updateRegistration = useMutation(api.registration.updateAttendance);
	const handleUpdateRegistration = async (
		registrationId: Id<"registrations">,
		newStatus: string,
	) => {
		updateRegistration({
			id: registrationId,
			newStatus: newStatus as "confirmed" | "late" | "no_show",
		})
			.then(() => {
				toast.success("Registreringen ble oppdatert", {
					description: humanReadableDate(new Date()),
				});
			})
			.catch((error) => {
				toast.error("Det oppsto en feil ved oppdatering av registreringen", {
					description: `${error.name}: ${error.message}`,
				});

				posthog.captureException("bifrost-registration_update_error", {
					site: "bifrost",
					error,
					registrationId,
					newStatus,
				});
			});
	};

	const handleSendEmail = (registerd: boolean, copy: boolean) => {
		const registrationsToUse = registerd ? registrations.registered : registrations.waitlist;
		const emails = registrationsToUse
			.map((reg) => {
				if (reg.status === "pending") return;
				return reg.userEmail;
			})
			.filter((r) => r);

		if (copy) {
			navigator.clipboard.writeText(emails.join("\n"));
			toast.success("E-postlisten er kopiert til utklippstavlen");
			return;
		}

		if (emails.length === 0) {
			toast.error("Ingen e-poster å sende til");
			return;
		}

		const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(","))}`;
		window.open(mailto, "_blank", "noopener,noreferrer");
	};

	const handleCopyParticipantList = () => {
		const participantList = registrations.registered
			.map((registration) => {
				return `${registration.userName}\t${registration.userEmail.split("@")[0]}`;
			})
			.join("\n");

		navigator.clipboard.writeText(participantList);

		toast.success("Deltaker liste kopiert");
	};

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
			<div className="flex w-full justify-between">
				<TabsList>
					<TabsTrigger value='registered'>Påmeldte</TabsTrigger>
					<TabsTrigger value='waitlist' disabled={waitlistData.length === 0}>
						Venteliste
					</TabsTrigger>
				</TabsList>
				<QRScannerDialog />
			</div>
			<TabsContent value='registered'>
				<div className="my-2 flex flex-wrap items-center justify-between border-b">
					<h2 className='scroll-m-20 font-semibold text-2xl tracking-tight first:mt-0'>Påmeldte</h2>

					<div className='flex flex-wrap gap-2 md:gap-4'>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant='outline' className='mb-3'>
									<Mails size={4} /> Send e-post
								</Button>
							</PopoverTrigger>
							<PopoverContent>
								<div className='flex flex-col gap-4'>
									<Button
										onClick={() => handleSendEmail(true, false)}
										type='button'
										variant='default'
									>
										Send epost til deltakerne
									</Button>
									<Button onClick={() => handleSendEmail(true, true)}>Kopier epost listen</Button>
								</div>
							</PopoverContent>
						</Popover>
						<Button variant='outline' className='mb-3' onClick={handleCopyParticipantList}>
							<Copy size={4} /> Kopier deltakerliste
						</Button>
					</div>
				</div>
				<RegistrationsTable
					columns={columns}
					data={registeredData}
					className='overflow-clip rounded-lg'
				/>
			</TabsContent>

			<TabsContent value='waitlist'>
				<div className='mt-4 mb-2'>
					<h2 className='scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0'>
						Venteliste
					</h2>
				</div>
				<RegistrationsTable
					columns={columns}
					data={waitlistData}
					empty_message='Ingen på venteliste'
					className='overflow-clip rounded-lg'
				/>
			</TabsContent>
		</Tabs>
	);
}
