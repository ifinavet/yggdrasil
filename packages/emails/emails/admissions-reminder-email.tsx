import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Text } from "react-email";
import { OrderLayout } from "../components/order-layout.js";

export default function AdmissionsReminderEmail({
	firstName,
	periodTitle,
	when,
	room,
}: Readonly<{ firstName: string; periodTitle: string; when: string; room: string }>) {
	return (
		<OrderLayout
			preview={`Påminnelse om intervju for ${periodTitle}`}
			contactEmail={EVENT_CONTACT_EMAIL}
		>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Dette er en påminnelse om intervjuet ditt for ${periodTitle}.`}</Text>
			<Text>{`Tid: ${when}`}</Text>
			<Text>{`Sted: ${room}`}</Text>
			<Text>Svar på denne e-posten hvis tidspunktet ikke lenger passer.</Text>
		</OrderLayout>
	);
}

AdmissionsReminderEmail.PreviewProps = {
	firstName: "Kari",
	periodTitle: "Høstopptak 2026",
	when: "mandag 12. oktober kl. 10:00",
	room: "Beta",
};
