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
			<Text>{`Nå er annonsene til ${companyName} ute på ifinavet.no (${reference}). Lykke til med rekrutteringen!`}</Text>
			{listings.map((listing) => (
				<Text key={listing.url} style={{ margin: "0 0 4px" }}>
					<Link href={listing.url}>{listing.title}</Link>
				</Text>
			))}
			<Text>
				Fakturaen sendes til fakturaadressen dere har oppgitt. Si ifra hvis dere vil endre noe i
				annonsene, så hjelper vi dere.
			</Text>
		</OrderLayout>
	);
}

JobListingOrderPublishedEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	listings: [{ title: "Sommerjobb backend", url: "https://ifinavet.no/job-listings/example" }],
};
