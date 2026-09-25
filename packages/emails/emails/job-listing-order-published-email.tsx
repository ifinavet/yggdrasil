import { Link, Text } from "react-email";
import { OrderLayout } from "../components/order-layout.js";

export default function JobListingOrderPublishedEmail({
	companyName,
	reference,
	listings,
}: Readonly<{
	companyName: string;
	reference: string;
	listings: ReadonlyArray<{ title: string; url: string }>;
}>) {
	return (
		<OrderLayout preview="Stillingsannonsene er publisert">
			<Text>Hei,</Text>
			<Text>{`Annonsene til ${companyName} er publisert (${reference}).`}</Text>
			{listings.map((listing) => (
				<Text key={listing.url} style={{ margin: "0 0 4px" }}>
					<Link href={listing.url}>{listing.title}</Link>
				</Text>
			))}
			<Text>Fakturaen sendes til fakturaadressen dere har oppgitt.</Text>
		</OrderLayout>
	);
}

JobListingOrderPublishedEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	listings: [{ title: "Sommerjobb backend", url: "https://ifinavet.no/job-listings/example" }],
};
