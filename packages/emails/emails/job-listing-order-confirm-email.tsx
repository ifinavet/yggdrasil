import { Link, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function JobListingOrderConfirmEmail({
	companyName,
	reference,
	url,
}: Readonly<{ companyName: string; reference: string; url: string }>) {
	return (
		<OrderLayout preview="Bekreft bestillingen, så får vi den">
			<Text>Hei,</Text>
			<Text>
				{`Takk for at ${companyName} vil annonsere hos oss! Trykk på knappen under for å bekrefte bestillingen (${reference}), så får vi den.`}
			</Text>
			<OrderButton href={url}>Bekreft bestillingen</OrderButton>
			<Text>
				Lenken virker i 24 timer. Virker ikke knappen, kan dere lime inn denne lenken i nettleseren:{" "}
				<Link href={url}>{url}</Link>
			</Text>
			<Text>
				Har dere ikke bestilt noe, kan dere bare se bort fra denne e-posten. Lurer dere på noe,
				svarer vi gjerne. Bare svar på denne e-posten.
			</Text>
		</OrderLayout>
	);
}

JobListingOrderConfirmEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	url: "https://hugin.ifinavet.no/bestill-stillingsannonse/bekreft#token=example",
};
