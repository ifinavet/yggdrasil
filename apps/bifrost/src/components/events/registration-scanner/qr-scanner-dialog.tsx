"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { QrCode } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import type * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import QRScanner from "@/components/events/registration-scanner/qr-scanner";
import { humanReadableDate } from "@/utils/utils";
import RegisterAttendanceByQr from "./register-by-qr-code";

export type QRScannerDialogProps = {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChangeAction?: (open: boolean) => void;
	title?: string;
	description?: string;
	trigger?: React.ReactNode;
	contentClassName?: string;
	showCloseButton?: boolean;
	/**
	 * Props applied to the default trigger Button when a custom `trigger` isn't provided.
	 */
	triggerButtonProps?: React.ComponentProps<typeof Button>;
};

/**
 * A reusable dialog that wraps the QRScanner component.
 *
 * Usage:
 * <QRScannerDialog />
 * or with a custom trigger:
 * <QRScannerDialog trigger={<Button>Åpne skanner</Button>} />
 */
export default function QRScannerDialog({
	open,
	defaultOpen,
	onOpenChangeAction,
	title = "Scan QR kode",
	description = "Bruk kameraet til å registrere oppmøte.",
	trigger,
	contentClassName,
	showCloseButton = true,
	triggerButtonProps,
}: QRScannerDialogProps) {
	const [registrationId, setRegistrationId] = useState<Id<"registrations"> | null>(null);

	const registrant = useQuery(
		api.registration.getUserByRegistrationId,
		registrationId ? { id: registrationId as Id<"registrations"> } : "skip",
	);

	const postHog = usePostHog();

	const register = useMutation(api.registration.updateAttendance);
	const handleRegister = (newStatus: "confirmed" | "late") =>
		register({
			id: registrationId as Id<"registrations">,
			newStatus: newStatus,
		})
			.then(() => {
				toast.success("Registration successful", {
					description: humanReadableDate(new Date()),
				});

				postHog.capture("bifrost-attendance_updated", {
					site: "bifrost",
					newStatus,
					registrationId,
				});
			}
			)
			.catch((e) => {
				toast.error("An error occurred, please try again or register manually.", {
					description:
						"If the error persists, please notify the Web Administrator. The event has been logged.",
				});

				postHog.captureException("bifrost-registration_by_qr_code_error", {
					site: "bifrost",
					registrationId,
					newStatus,
					error: e,
				});
			})
			.finally(() => setRegistrationId(null));

	return (
		<Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChangeAction}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button {...triggerButtonProps} className="text-white">
						<QrCode className="size-4" /> Scan QR
					</Button>
				)}
			</DialogTrigger>
			<DialogContent
				className={cn("mx-auto sm:max-w-[28rem] md:max-w-xl xl:w-auto", contentClassName)}
				showCloseButton={showCloseButton}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? <DialogDescription>{description}</DialogDescription> : null}
				</DialogHeader>
				<QRScanner onDecodedAction={(text) => setRegistrationId(text as Id<"registrations">)} />
				<p>
					<strong>Student: </strong>
					{registrant ? `${registrant?.firstName} ${registrant?.lastName}` : "venter..."}
				</p>
				{registrationId ? <RegisterAttendanceByQr onRegisterAction={handleRegister} /> : null}
			</DialogContent>
		</Dialog>
	);
}
