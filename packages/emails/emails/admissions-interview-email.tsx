import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Section, Text } from "react-email";
import { OrderLayout } from "../components/order-layout.js";

export default function AdmissionsInterviewEmail({
	firstName,
	periodTitle,
	when,
	room,
}: Readonly<{ firstName: string; periodTitle: string; when: string; room: string }>) {
	return (
		<OrderLayout preview={`Intervju for ${periodTitle}`} contactEmail={EVENT_CONTACT_EMAIL}>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Vi vil gjerne invitere deg til intervju i forbindelse med ${periodTitle}.`}</Text>
			<Section style={{ backgroundColor: "#f6f7f9", padding: "16px" }}>
				<Text>{`Tid: ${when}`}</Text>
				<Text>{`Sted: ${room}`}</Text>
			</Section>
			<Text>
				Invitasjonen er også lagt i kalenderen. Svar på denne e-posten hvis tidspunktet ikke passer.
			</Text>
		</OrderLayout>
	);
}

AdmissionsInterviewEmail.PreviewProps = {
	firstName: "Kari",
	periodTitle: "Høstopptak 2026",
	when: "mandag 12. oktober kl. 10:00",
	room: "Beta",
};
