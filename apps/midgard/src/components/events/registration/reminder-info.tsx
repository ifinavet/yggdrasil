"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { renderReminderInfo } from "@workspace/shared/events/reminder";
import { Note } from "@workspace/ui/components/note";
import { cn } from "@workspace/ui/lib/utils";
import { useQuery } from "convex/react";
import SanitizeHtml from "@/components/common/sanitize-html";

export default function ReminderInfo({
	className,
	eventId,
}: Readonly<{
	className?: string;
	eventId: Id<"events">;
}>) {
	const info = useQuery(api.events.reminders.queries.getOwnReminderInfo, {
		eventIdentifier: eventId,
	});

	if (!info) return null;

	return (
		<Note
			tone="info"
			className={cn(
				"rounded-xl p-6 text-base dark:bg-blue-950/60 dark:text-blue-50 [&>svg]:mt-1 [&>svg]:size-5",
				className,
			)}
		>
			<div className="flex flex-col gap-2">
				<p className="font-semibold text-lg">Viktig info</p>
				<SanitizeHtml
					html={renderReminderInfo(info)}
					className="prose max-w-none text-inherit [&_*]:text-inherit"
				/>
			</div>
		</Note>
	);
}
