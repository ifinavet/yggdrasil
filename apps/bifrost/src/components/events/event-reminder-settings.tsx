"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { useFeatureEnabled } from "@workspace/ui/hooks/use-feature-enabled";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export function EventReminderSettings({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const enabled = useFeatureEnabled("eventReminders");
	if (!enabled) return null;
	return <ReminderToggle eventId={eventId} />;
}

function ReminderToggle({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const settings = useQuery(api.events.reminders.queries.getEventReminders, { eventId });
	const setReminders = useMutation(
		api.events.reminders.mutations.setEventReminders,
	).withOptimisticUpdate((store, { enabled }) => {
		store.setQuery(api.events.reminders.queries.getEventReminders, { eventId }, { enabled });
	});
	const onCheckedChange = (checked: boolean) =>
		setReminders({ eventId, enabled: checked }).catch((error) =>
			toast.error(convexErrorMessage(error, "Kunne ikke lagre påminnelser. Prøv igjen.")),
		);
	return (
		<Card className="max-w-3xl">
			<CardHeader>
				<CardTitle>Påminnelser</CardTitle>
			</CardHeader>
			<CardContent>
				<Field orientation="horizontal">
					<Checkbox
						id="event-reminders-enabled"
						checked={settings?.enabled ?? false}
						disabled={!settings}
						onCheckedChange={(checked) => onCheckedChange(checked === true)}
					/>
					<FieldLabel htmlFor="event-reminders-enabled">
						Send påminnelse på e-post til påmeldte en uke og to dager før arrangementet
					</FieldLabel>
				</Field>
			</CardContent>
		</Card>
	);
}
