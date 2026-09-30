"use client";

import { api } from "@workspace/backend/convex/api";
import { type ChecklistPhase, helperConfirmation } from "@workspace/shared/events/checklist";
import {
	DAY_MS,
	feedbackOpensAt,
	feedbackRoundAt,
	formatOsloDate,
	REMINDER_DAYS,
} from "@workspace/shared/time";
import { convexErrorMessage } from "@workspace/shared/utils";
import { type Preloaded, useMutation, usePreloadedQuery, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { useMinute } from "@/hooks/use-minute";
import { type ChecklistMilestone, EventChecklist } from "./event-checklist";

export function EventChecklistPanel({
	preloadedEvent,
}: Readonly<{ preloadedEvent: Preloaded<typeof api.events.queries.getEvent> }>) {
	const event = usePreloadedQuery(preloadedEvent);
	const now = useMinute();
	const campaign = useQuery(api.feedback.delivery.status.getEventFeedbackDelivery, {
		eventId: event._id,
	});
	const completed = new Set(event.completedChecklistSteps ?? []);
	const [saving, setSaving] = useState(false);
	const setStep = useMutation(api.events.mutations.setChecklistStep);
	const day = (at: number) => formatOsloDate(at, "d. MMM");
	const eventDay = formatOsloDate(event.eventStart, "yyyy-MM-dd");
	const today = formatOsloDate(now, "yyyy-MM-dd");
	let currentPhase: ChecklistPhase = "planning";
	if (now >= event.registrationOpens) currentPhase = "registration";
	if (now >= event.eventStart - 7 * DAY_MS) currentPhase = "preparation";
	if (today === eventDay) currentPhase = "event";
	if (today > eventDay) currentPhase = "followup";
	const date = (at: number) => `${day(at)} (uke ${formatOsloDate(at, "I")})`;
	const relativeDate = (at: number) => {
		const days = Math.round(
			(Date.parse(formatOsloDate(at, "yyyy-MM-dd")) - Date.parse(today)) / DAY_MS,
		);
		let relative = `for ${Math.abs(days)} dager siden`;
		if (days === 0) relative = "i dag";
		else if (days === 1) relative = "i morgen";
		else if (days > 0) relative = `om ${days} dager`;
		return `${date(at)}, ${relative}`;
	};
	const opensAt = campaign?.opensAt ?? feedbackOpensAt(event.eventStart);
	const closesAt = campaign?.closesAt ?? feedbackRoundAt(opensAt, 14);
	let reminders: string[];
	if (event.externalEvent) reminders = ["Ingen deltakerpåminnelser ved ekstern påmelding."];
	else if (!event.remindersEnabled || !event.published) reminders = ["Deltakerpåminnelser er av."];
	else
		reminders = [
			`${day(event.eventStart - 7 * DAY_MS)}: Systemet sender ut påminnelsesmail nr. 1.`,
			`${day(event.eventStart - 2 * DAY_MS)}: Systemet sender ut påminnelsesmail nr. 2.`,
		];
	let feedback: string[];
	if (campaign === undefined) feedback = ["Henter utsendelsesplan …"];
	else if (!campaign || campaign.status === "cancelled")
		feedback = [campaign?.failure ?? "Tilbakemeldingsskjema er ikke planlagt."];
	else
		feedback = [
			`${day(opensAt)} kl. ${formatOsloDate(opensAt, "HH:mm")}: Systemet sender tilbakemeldingsskjema til fremmøtte.`,
			...REMINDER_DAYS.map(
				(round, index) =>
					`${day(feedbackRoundAt(opensAt, round))}: Systemet sender purring nr. ${index + 1} til dem som ikke har svart.`,
			),
			`${day(closesAt)}: Systemet lager rapporten. Sendes til bedriften etter din godkjenning.`,
		];
	const isPastDay = (at: number) => formatOsloDate(at, "yyyy-MM-dd") < today;
	const milestones: ChecklistMilestone[] = [
		{
			id: "planning",
			date: `${date(feedbackRoundAt(event.eventStart, -35))} – ${date(feedbackRoundAt(event.eventStart, -28))}`,
			overdue: isPastDay(feedbackRoundAt(event.eventStart, -28)),
		},
		{
			id: "registration",
			date: relativeDate(event.registrationOpens),
			overdue: now > event.registrationOpens,
		},
		{
			id: "preparation",
			date: relativeDate(event.eventStart - 2 * DAY_MS),
			overdue: isPastDay(event.eventStart - 2 * DAY_MS),
			automation: reminders,
		},
		{
			id: "event",
			date: relativeDate(event.eventStart),
			overdue: isPastDay(event.eventStart),
			automation: [
				...(campaign && campaign.status !== "cancelled"
					? [
							`${day(opensAt)} kl. ${formatOsloDate(opensAt, "HH:mm")}: Systemet sender tilbakemeldingsskjema til fremmøtte.`,
						]
					: []),
			],
			action: { label: "Registrer oppmøte", href: `/events/${event._id}/registrations` },
		},
		{
			id: "followup",
			date: `${date(opensAt)} – ${date(closesAt)}`,
			automation: feedback,
		},
	];
	return (
		<EventChecklist
			currentPhase={currentPhase}
			helpersLabel={helperConfirmation(
				event.organizers
					.filter((organizer) => organizer.role === "medhjelper")
					.map((organizer) => organizer.name),
			)}
			milestones={milestones}
			completed={completed}
			saving={saving}
			onToggle={async (stepId, checked) => {
				setSaving(true);
				try {
					await setStep({ eventId: event._id, stepId, completed: checked });
				} catch (error) {
					toast.error(convexErrorMessage(error, "Kunne ikke lagre sjekklisten."));
				} finally {
					setSaving(false);
				}
			}}
		/>
	);
}
