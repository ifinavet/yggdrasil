import { getEventById } from "@/lib/query/events";

export default async function EventPage({ params }: { params: Promise<{ slug: number }> }) {
  const event_id = (await params).slug;

  const event = await getEventById(event_id);

  if (!event) {
    return <div>Event not found</div>;
  }

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <ul>
        {event.organizers.map((organizer) => (
          <li key={organizer.user_id}>{organizer.role}: {organizer.user.fullName}<br />
            <img src={organizer.user.imageUrl} alt={organizer.user.fullName || "ukjent"} />
          </li>
        ))}
      </ul>
    </div>
  );
}
