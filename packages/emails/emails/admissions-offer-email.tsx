import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function AdmissionsOfferEmail({
	firstName,
	periodTitle,
	group,
	responseUrl,
}: Readonly<{
	firstName: string;
	periodTitle: string;
	group: string;
	responseUrl: string;
}>) {
	return (
		<OrderLayout preview={`Tilbud om opptak i ${group}`} contactEmail={EVENT_CONTACT_EMAIL}>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Vi vil gjerne tilby deg plass i ${group} i Navet gjennom opptaket ${periodTitle}.`}</Text>
			<Text>Logg inn på Hugin for å svare på tilbudet. Du kan takke ja eller nei.</Text>
			<Section style={{ margin: "24px 0" }}>
				<OrderButton href={responseUrl}>Svar på tilbudet</OrderButton>
			</Section>
			<Text>Tilbudet er personlig og kan bare besvares fra din egen Hugin-konto.</Text>
		</OrderLayout>
	);
}

