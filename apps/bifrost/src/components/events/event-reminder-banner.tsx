"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { REMINDER_INFO_MAX_LENGTH } from "@workspace/shared/events/reminder";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { CharacterCount } from "@workspace/ui/components/character-count";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { Note } from "@workspace/ui/components/note";
import { Textarea } from "@workspace/ui/components/textarea";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

type Preview = { subject: string; html: string; recipients: number };

export function EventReminderBanner({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const reminder = useQuery(api.events.reminders.queries.getEventReminders, { eventId });
	const [open, setOpen] = useState(false);
	if (!reminder || (!reminder.sendable && !reminder.sentAt)) return null;
	const sent = reminder.sentAt !== null;

	return (
		<>
			<Note tone={sent ? "ok" : "warn"} role="status" className="max-w-3xl items-center">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm">
						{reminder.sentAt
							? `Påminnelsen ble sendt ${formatOsloDate(reminder.sentAt, DATE_PATTERNS.dateTime)}${reminder.sentBy ? ` av ${reminder.sentBy}` : ""}.`
							: "Påminnelsesmailen er klar til å sendes."}
					</p>
					<Button
						type="button"
						size="sm"
						variant={sent ? "outline" : "default"}
						onClick={() => setOpen(true)}
					>
						{sent ? "Endre informasjonen" : "Send påminnelsen"}
					</Button>
				</div>
			</Note>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
					{open ? (
						<ReminderDialogBody
							eventId={eventId}
							savedInfo={reminder.info}
							sent={sent}
							onDone={() => setOpen(false)}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}

function ReminderDialogBody({
	eventId,
	savedInfo,
	sent,
	onDone,
}: Readonly<{
	eventId: Id<"events">;
	savedInfo: string;
	sent: boolean;
	onDone: () => void;
}>) {
	const [info, setInfo] = useState(savedInfo);
	const [busy, setBusy] = useState(false);
	const [preview, setPreview] = useState<Preview | null>(null);
	const saveInfo = useMutation(api.events.reminders.mutations.saveReminderInfo);
	const approve = useMutation(api.events.reminders.mutations.approveEventReminder);
	const loadPreview = useAction(api.events.reminders.emails.previewEventReminder);
	const tooLong = info.length > REMINDER_INFO_MAX_LENGTH;

	const run = async (task: () => Promise<void>, failure: string) => {
		setBusy(true);
		try {
			await task();
		} catch (error) {
			toast.error(convexErrorMessage(error, failure));
		} finally {
			setBusy(false);
		}
	};

	const onSave = () =>
		run(async () => {
			await saveInfo({ eventId, text: info });
			toast.success("Informasjonen er lagret.");
			onDone();
		}, "Kunne ikke lagre informasjonen. Prøv igjen.");

	const onReview = () =>
		run(async () => {
			const result = await loadPreview({ eventId, info });
			if (result) setPreview(result);
			else toast.error("Påminnelsen kan ikke sendes for dette arrangementet.");
		}, "Kunne ikke lage forhåndsvisning. Prøv igjen.");

	const onSend = () =>
		run(async () => {
			await approve({ eventId, text: info });
			toast.success("Påminnelsen sendes nå.");
			onDone();
		}, "Kunne ikke sende påminnelsen. Prøv igjen.");

	if (preview)
		return (
			<>
				<DialogHeader>
					<DialogTitle>{preview.subject}</DialogTitle>
					<DialogDescription>
						Påminnelsen går til {preview.recipients} påmeldte nå, og kan bare sendes én gang.
					</DialogDescription>
				</DialogHeader>
				<iframe
					title="Forhåndsvisning av påminnelsen"
					srcDoc={preview.html}
					sandbox=""
					className="h-[50dvh] w-full rounded-md border bg-white sm:h-[60vh]"
				/>
				<DialogFooter>
					<Button type="button" variant="outline" disabled={busy} onClick={() => setPreview(null)}>
						Tilbake
					</Button>
					<Button type="button" disabled={busy} onClick={onSend}>
						Send til {preview.recipients} påmeldte
					</Button>
				</DialogFooter>
			</>
		);

	return (
		<>
			<DialogHeader>
				<DialogTitle>Påminnelsesmail</DialogTitle>
			</DialogHeader>
			<Field>
				<FieldLabel htmlFor="event-reminder-info">Informasjon fra bedriften</FieldLabel>
				<FieldDescription>
					Står i påminnelsen og på arrangementssiden for dem som er påmeldt, for eksempel at de må
					ta med PC eller laste ned noe på forhånd. Lenker skrives som [tekst](https://adresse.no).
				</FieldDescription>
				<Textarea
					id="event-reminder-info"
					value={info}
					rows={8}
					aria-describedby="event-reminder-info-count"
					aria-invalid={tooLong}
					onChange={(event) => setInfo(event.target.value)}
				/>
				<CharacterCount
					id="event-reminder-info-count"
					length={info.length}
					max={REMINDER_INFO_MAX_LENGTH}
				/>
			</Field>
			<DialogFooter>
				<Button
					type="button"
					variant={sent ? "default" : "outline"}
					disabled={busy || tooLong || info.trim() === savedInfo}
					onClick={onSave}
				>
					Lagre
				</Button>
				{sent ? null : (
					<Button type="button" disabled={busy || tooLong} onClick={onReview}>
						Se over og send
					</Button>
				)}
			</DialogFooter>
		</>
	);
}
