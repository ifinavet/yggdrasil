import type { Tables } from "@/lib/supabase/database.types";
import EventCard from "./event-list-card";

export default async function EventsList({
	events,
	isExternal,
}: {
	events: Tables<"published_events_with_participation_count">[];
	isExternal: boolean;
}) {
	return (
		<div className='mx-6 md:mx-auto md:w-3/5'>
			<div className='flex flex-col gap-6'>
				{events.map((event) => (
					<EventCard key={event.event_id} event={event} isExternal={isExternal} />
				))}
			</div>
		</div>
	);
}
