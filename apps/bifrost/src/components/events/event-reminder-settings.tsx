"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { REMINDER_INFO_MAX_LENGTH } from "@workspace/shared/events/reminder";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { CharacterCount } from "@workspace/ui/components/character-count";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

type Preview = { subject: string; html: string; recipients: number };

export function EventReminderSettings({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const settings = useQuery(api.events.reminders.queries.getEventReminders, { eventId });
	const setReminders = useMutation(
		api.events.reminders.mutations.setEventReminders,
	).withOptimisticUpdate((store, { enabled }) => {
		const current = store.getQuery(api.events.reminders.queries.getEventReminders, { eventId });
		if (current)
			store.setQuery(
				api.events.reminders.queries.getEventReminders,
				{ eventId },
				{ ...current, enabled },
			);
	});
	const onCheckedChange = (checked: boolean) =>
		setReminders({ eventId, enabled: checked }).catch((error) =>
			toast.error(convexErrorMessage(error, "Kunne ikke lagre påminnelser. Prøv igjen.")),
		);
	return (
		<Card className="max-w-3xl">
			<CardHeader>
				<CardTitle>Påminnelse</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<Field orientation="horizontal">
					<Checkbox
						id="event-reminders-enabled"
						checked={settings?.enabled ?? false}
						disabled={!settings || settings.sentAt !== null}
						onCheckedChange={(checked) => onCheckedChange(checked === true)}
					/>
					<FieldLabel htmlFor="event-reminders-enabled">
						Send en påminnelse på e-post til de påmeldte før arrangementet. Fjern haken for å slå
						den av.
					</FieldLabel>
				</Field>
				{settings?.enabled ? (
					<ReminderInfoForm
						key={settings.info}
						eventId={eventId}
						savedInfo={settings.info}
						sentAt={settings.sentAt}
						sentBy={settings.sentBy}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}

function ReminderInfoForm({
	eventId,
	savedInfo,
	sentAt,
	sentBy,
}: Readonly<{
	eventId: Id<"events">;
	savedInfo: string;
	sentAt: number | null;
	sentBy: string | null;
}>) {
	const [info, setInfo] = useState(savedInfo);
	const [saving, setSaving] = useState(false);
	const [preview, setPreview] = useState<Preview | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const saveInfo = useMutation(api.events.reminders.mutations.saveReminderInfo);
	const approve = useMutation(api.events.reminders.mutations.approveEventReminder);
	const loadPreview = useAction(api.events.reminders.emails.previewEventReminder);
	const changed = info.trim() !== savedInfo;
	const tooLong = info.length > REMINDER_INFO_MAX_LENGTH;

	const onSave = async () => {
		setSaving(true);
		try {
			await saveInfo({ eventId, text: info });
			toast.success("Informasjonen er lagret.");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke lagre informasjonen. Prøv igjen."));
		} finally {
			setSaving(false);
		}
	};

	const openPreview = async (next: () => void) => {
		try {
			const result = await loadPreview({ eventId, info });
			if (!result) {
				toast.error("Påminnelsen kan ikke sendes for dette arrangementet.");
				return;
			}
			setPreview(result);
			next();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke lage forhåndsvisning. Prøv igjen."));
		}
	};

	const onApprove = async () => {
		try {
			await approve({ eventId, text: info });
			toast.success("Påminnelsen sendes nå.");
			return true;
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke sende påminnelsen. Prøv igjen."));
			return false;
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<Field>
				<FieldLabel htmlFor="event-reminder-info">Informasjon fra bedriften</FieldLabel>
				<FieldDescription>
					Står i påminnelsen og på arrangementssiden for dem som er påmeldt, for eksempel at de må
					ta med PC eller laste ned noe på forhånd.
				</FieldDescription>
				<Textarea
					id="event-reminder-info"
					value={info}
					rows={5}
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
			{sentAt ? (
				<p className="text-muted-foreground text-sm">
					Påminnelsen ble sendt {formatOsloDate(sentAt, DATE_PATTERNS.dateTime)}
					{sentBy ? ` av ${sentBy}` : ""}.
				</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				{sentAt ? null : (
					<Button
						type="button"
						disabled={tooLong}
						onClick={() => openPreview(() => setConfirmOpen(true))}
					>
						Send påminnelsen
					</Button>
				)}
				<Button
					type="button"
					variant="outline"
					disabled={!changed || tooLong || saving}
					onClick={onSave}
				>
					{saving ? "Lagrer..." : "Lagre"}
				</Button>
				<Button
					type="button"
					variant="ghost"
					disabled={tooLong}
					onClick={() => openPreview(() => setPreviewOpen(true))}
				>
					Forhåndsvis e-posten
				</Button>
			</div>
			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>{preview?.subject}</DialogTitle>
						<DialogDescription>
							Sendes til {preview?.recipients ?? 0} påmeldte når dere sender påminnelsen.
						</DialogDescription>
					</DialogHeader>
					<ReminderPreview preview={preview} />
				</DialogContent>
			</Dialog>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="Send påminnelsen?"
				description={`Påminnelsen går til ${preview?.recipients ?? 0} påmeldte nå, og kan bare sendes én gang.`}
				confirmLabel="Send"
				onConfirm={onApprove}
			>
				<ReminderPreview preview={preview} />
			</ConfirmDialog>
		</div>
	);
}

function ReminderPreview({ preview }: Readonly<{ preview: Preview | null }>) {
	if (!preview) return null;
	return (
		<iframe
			title="Forhåndsvisning av påminnelsen"
			srcDoc={preview.html}
			sandbox=""
			className="h-[60vh] w-full rounded-md border bg-white"
		/>
	);
}
