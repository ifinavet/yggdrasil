import { Link, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function JobListingOrderConfirmEmail({
	companyName,
	reference,
	url,
}: Readonly<{ companyName: string; reference: string; url: string }>) {
	return (
		<OrderLayout preview="Bekreft bestillingen av stillingsannonser">
			<Text>Hei,</Text>
			<Text>
				{`Vi har mottatt en bestilling av stillingsannonser for ${companyName} (${reference}). Bestillingen er ikke sendt til oss før du bekrefter den.`}
			</Text>
			<OrderButton href={url}>Bekreft bestillingen</OrderButton>
			<Text>
				Lenken virker i 24 timer. Fikk du ikke til å klikke på knappen, kan du lime inn denne lenken
				i nettleseren: <Link href={url}>{url}</Link>
			</Text>
			<Text>Har du ikke bestilt noe, kan du se bort fra denne e-posten.</Text>
		</OrderLayout>
	);
}

JobListingOrderConfirmEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	url: "https://hugin.ifinavet.no/bestill-stillingsannonse/bekreft#token=example",
};
