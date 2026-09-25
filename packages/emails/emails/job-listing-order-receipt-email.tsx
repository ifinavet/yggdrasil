import { Text } from "react-email";
import { OrderLayout, OrderSummary } from "../components/order-layout.js";

export default function JobListingOrderReceiptEmail({
	companyName,
	reference,
	productName,
	quantity,
	price,
	titles,
	updateRequested,
}: Readonly<{
	companyName: string;
	reference: string;
	productName: string;
	quantity: number;
	price: string;
	titles: readonly string[];
	updateRequested: boolean;
}>) {
	return (
		<OrderLayout preview={`Kvittering for bestilling ${reference}`}>
			<Text>Hei,</Text>
			<Text>{`Takk! Bestillingen for ${companyName} er bekreftet.`}</Text>
			<OrderSummary
				rows={[
					["Referanse", reference],
					["Pakke", productName],
					["Antall annonser", String(quantity)],
					["Pris eks. mva.", price],
				]}
			/>
			<Text>{`Annonsene: ${titles.join(", ")}.`}</Text>
			<Text style={{ margin: "0 0 4px" }}>
				Vi går gjennom bestillingen og publiserer annonsene på ifinavet.no, vanligvis innen to
				virkedager.
			</Text>
			{updateRequested && (
				<Text style={{ margin: "0 0 4px" }}>
					Endringene i bedriftsinformasjonen godkjennes før annonsene publiseres.
				</Text>
			)}
			<Text style={{ margin: "0 0 4px" }}>
				Du får en e-post når annonsene er publisert. Fakturaen kommer etter publisering.
			</Text>
		</OrderLayout>
	);
}

JobListingOrderReceiptEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	productName: "Stillingsannonse",
	quantity: 2,
	price: "5 500 kr",
	titles: ["Sommerjobb backend", "Fulltid frontend"],
	updateRequested: true,
};
