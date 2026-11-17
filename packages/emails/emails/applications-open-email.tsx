import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Link, Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

/** To a company that asked to hear when applications open: they are open now. */
export default function ApplicationsOpenEmail({
	companyName,
	semester,
	deadline,
	url,
}: Readonly<{ companyName: string; semester: string; deadline: string; url: string }>) {
	return (
		<OrderLayout
			preview={`Nå kan dere søke om bedriftsarrangement ${semester}`}
			contactEmail={COMPANY_CONTACT_EMAIL}
		>
			<Text>Hei,</Text>
			<Text>
				{`Dere ba om å få beskjed når søknadene åpner. Nå kan ${companyName} søke om å holde bedriftspresentasjon eller annet arrangement for informatikkstudentene ${semester}. Søknadsfristen er ${deadline}.`}
			</Text>
			<Section style={{ margin: "24px 0" }}>
				<OrderButton href={url}>Søk her</OrderButton>
			</Section>
			<Text>
				Virker ikke knappen, kan dere lime inn denne lenken i nettleseren:{" "}
				<Link href={url}>{url}</Link>
			</Text>
		</OrderLayout>
	);
}

ApplicationsOpenEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	semester: "våren 2027",
	deadline: "fredag 4. desember",
	url: "https://hugin.ifinavet.no/bestill-bedpres",
};
