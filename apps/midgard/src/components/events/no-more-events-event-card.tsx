import NavetLogo from "@/assets/navet/simple_logo_blaa.webp";
import EventCard from "./event-card";

export default function NoMoreEventsEventCard() {
	return (
		<EventCard
			event={{
				companyImage: NavetLogo.src,
				companyTitle: "Navet",
				title: "Ingen flere arrangementer",
				teaser: "Det er desverre ingen flere arrangementer!",
			}}
		/>
	);
}
