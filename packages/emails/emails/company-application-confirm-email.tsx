import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Link, Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function CompanyApplicationConfirmEmail({
	companyName,
	url,
}: Readonly<{ companyName: string; url: string }>) {
	return (
		<OrderLayout preview="Bekreft søknaden, så får vi den" contactEmail={COMPANY_CONTACT_EMAIL}>
			<Text>Hei,</Text>
			<Text>
				{`Så hyggelig at ${companyName} vil holde et arrangement for studentene våre! Trykk på knappen under for å bekrefte søknaden, så får vi den.`}
			</Text>
			<Section style={{ margin: "24px 0" }}>
				<OrderButton href={url}>Bekreft søknaden</OrderButton>
			</Section>
			<Text>
				Lenken virker i 24 timer. Virker ikke knappen, kan dere lime inn denne lenken i nettleseren:{" "}
				<Link href={url}>{url}</Link>
			</Text>
			<Text>
				Har dere ikke søkt, kan dere bare se bort fra denne e-posten. Lurer dere på noe, svarer vi
				gjerne. Bare svar på denne e-posten.
			</Text>
		</OrderLayout>
	);
}

CompanyApplicationConfirmEmail.PreviewProps = {
	companyName: "FJORDKODE AS",
	url: "https://hugin.ifinavet.no/bestill-bedpres/bekreft#token=example",
};
