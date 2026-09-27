import { JOB_LISTING_ORDER_EMAIL } from "@workspace/shared/constants/contact";
import { Text } from "react-email";
import { OrderLayout } from "../components/order-layout.js";

export default function JobListingOrderRejectedEmail({
	companyName,
	reference,
	reason,
}: Readonly<{ companyName: string; reference: string; reason: string }>) {
	return (
		<OrderLayout preview="Bestillingen ble ikke publisert">
			<Text>Hei,</Text>
			<Text>{`Vi har gått gjennom bestillingen for ${companyName} (${reference}) og kan ikke publisere den.`}</Text>
			<Text style={{ borderLeft: "3px solid #dde3ea", paddingLeft: "12px" }}>{reason}</Text>
			<Text>{`Svar på denne e-posten eller skriv til ${JOB_LISTING_ORDER_EMAIL} hvis du har spørsmål.`}</Text>
		</OrderLayout>
	);
}

JobListingOrderRejectedEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	reason: "Søknadslenken virker ikke.",
};
