import { Text } from "react-email";
import { OrderButton, OrderLayout, OrderSummary } from "../components/order-layout.js";

export default function JobListingOrderAdminEmail({
	companyName,
	reference,
	quantity,
	price,
	updateRequested,
	reviewUrl,
}: Readonly<{
	companyName: string;
	reference: string;
	quantity: number;
	price: string;
	updateRequested: boolean;
	reviewUrl: string;
}>) {
	return (
		<OrderLayout preview={`Ny bestilling fra ${companyName}`}>
			<Text>{`${companyName} har bestilt stillingsannonser.`}</Text>
			<OrderSummary
				rows={[
					["Referanse", reference],
					["Antall annonser", String(quantity)],
					["Pris eks. mva.", price],
					["Endring i bedriftsinfo", updateRequested ? "Ja" : "Nei"],
				]}
			/>
			<OrderButton href={reviewUrl}>Gå gjennom bestillingen</OrderButton>
		</OrderLayout>
	);
}

JobListingOrderAdminEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	quantity: 2,
	price: "5 500 kr",
	updateRequested: true,
	reviewUrl: "https://bifrost.ifinavet.no/job-listings",
};
