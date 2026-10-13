import type { EventWithParticipationCount } from "@/constants/event-types";
import EventCard from "./event-list-card";

export default function EventsList({
	upcoming,
	past,
}: Readonly<{
	upcoming: EventWithParticipationCount[];
	past: EventWithParticipationCount[];
}>) {
	return (
		<div className="mx-6 max-w-7xl md:mx-auto md:w-3/5">
			<div className="flex flex-col gap-6">
				{upcoming.map((event) => (
					<EventCard key={event._id} event={event} />
				))}
				{past.length > 0 && (
					<div className="flex items-center gap-4 pt-4 font-semibold text-zinc-500 dark:text-zinc-400">
						<hr className="flex-1 border-zinc-300 dark:border-zinc-700" />
						Tidligere arrangementer
						<hr className="flex-1 border-zinc-300 dark:border-zinc-700" />
					</div>
				)}
				{past.map((event) => (
					<div key={event._id} className="opacity-50 grayscale transition hover:opacity-80">
						<EventCard event={event} />
					</div>
				))}
			</div>
		</div>
	);
}
