"use client";

import { EditorContent } from "@tiptap/react";
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
import { cn } from "@workspace/ui/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { EditorMenu } from "@/components/common/forms/markdown-editor/markdown-editor";
import { useContentEditor } from "@/components/common/forms/markdown-editor/use-content-editor";

type Preview = { subject: string; html: string; recipients: number };

type Reminder = NonNullable<
	FunctionReturnType<typeof api.events.reminders.queries.getEventReminders>
>;

function statusText({ approvedAt, approvedBy, delivered }: Reminder) {
	if (approvedAt === null) return "Påminnelsesmailen er klar til å sendes.";
	if (!delivered) return "Påminnelsen er på vei ut.";
	const by = approvedBy ? ` av ${approvedBy}` : "";
	return `Påminnelsen ble sendt ${formatOsloDate(approvedAt, DATE_PATTERNS.dateTime)}${by}.`;
}

export function EventReminderBanner({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const reminder = useQuery(api.events.reminders.queries.getEventReminders, { eventId });
	const retry = useMutation(api.events.reminders.mutations.retryEventReminder);
	const [open, setOpen] = useState(false);
	const [retrying, setRetrying] = useState(false);
	if (!reminder || (!reminder.sendable && reminder.approvedAt === null)) return null;
	const sent = reminder.approvedAt !== null;

	const onRetry = async () => {
		setRetrying(true);
		try {
			await retry({ eventId });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke sende påminnelsen. Prøv igjen."));
		} finally {
			setRetrying(false);
		}
	};

	return (
		<>
			<Note
				tone={reminder.delivered ? "ok" : "warn"}
				role="status"
				className="max-w-3xl items-center"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm">{statusText(reminder)}</p>
					<div className="flex flex-wrap gap-2">
						{sent && !reminder.delivered && reminder.sendable ? (
							<Button type="button" size="sm" disabled={retrying} onClick={onRetry}>
								Prøv igjen
							</Button>
						) : null}
						<Button
							type="button"
							size="sm"
							variant={sent ? "outline" : "default"}
							onClick={() => setOpen(true)}
						>
							{sent ? "Endre informasjonen" : "Send påminnelsen"}
						</Button>
					</div>
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
	const editor = useContentEditor({
		placeholder: "",
		initialContent: savedInfo,
		onContentChange: setInfo,
		markdown: true,
	});
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
					<Button type="button" disabled={busy || preview.recipients === 0} onClick={onSend}>
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
				<FieldLabel>Viktig info</FieldLabel>
				<FieldDescription>
					Det du skriver her havner i mailen til studentene og i en info-boks på arrangementet på
					ifinavet.no.
				</FieldDescription>
				<div className={cn("overflow-clip rounded-md border", tooLong && "border-destructive")}>
					<EditorMenu editor={editor} />
					<EditorContent editor={editor} />
				</div>
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
