import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Text } from "react-email";
import { OrderLayout } from "../components/order-layout.js";

export default function AdmissionsRejectionEmail({
	firstName,
	periodTitle,
}: Readonly<{ firstName: string; periodTitle: string }>) {
	return (
		<OrderLayout
			preview={`Svar på søknaden din til ${periodTitle}`}
			contactEmail={EVENT_CONTACT_EMAIL}
		>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Takk for søknaden din til ${periodTitle}. Denne gangen kan vi dessverre ikke tilby deg plass i Navet.`}</Text>
			<Text>Takk for at du tok deg tid til å søke, og lykke til videre.</Text>
		</OrderLayout>
	);
}

AdmissionsRejectionEmail.PreviewProps = {
	firstName: "Kari",
	periodTitle: "Høstopptak 2026",
};
