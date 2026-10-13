import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Link, Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function CompanyApplicationConfirmEmail({
	companyName,
	url,
}: Readonly<{ companyName: string; url: string }>) {
	return (
		<OrderLayout preview="Bekreft søknaden om bedpres" contactEmail={COMPANY_CONTACT_EMAIL}>
			<Text>Hei,</Text>
			<Text>
				{`Vi har mottatt en søknad om bedriftsarrangement for ${companyName}. Søknaden er ikke sendt til oss før du bekrefter den.`}
			</Text>
			<Section style={{ margin: "24px 0" }}>
				<OrderButton href={url}>Bekreft søknaden</OrderButton>
			</Section>
			<Text>
				Lenken virker i 24 timer. Fikk du ikke til å klikke på knappen, kan du lime inn denne lenken
				i nettleseren: <Link href={url}>{url}</Link>
			</Text>
			<Text>Har du ikke søkt, kan du se bort fra denne e-posten.</Text>
		</OrderLayout>
	);
}

CompanyApplicationConfirmEmail.PreviewProps = {
	companyName: "FJORDKODE AS",
	url: "https://hugin.ifinavet.no/bestill-bedpres/bekreft#token=example",
};
