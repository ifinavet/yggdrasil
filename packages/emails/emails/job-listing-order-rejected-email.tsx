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
			<Text>{`Takk for bestillingen fra ${companyName} (${reference}). Vi har sett over den, og dessverre kan vi ikke publisere den slik den er nå.`}</Text>
			<Text style={{ borderLeft: "3px solid #dde3ea", paddingLeft: "12px" }}>{reason}</Text>
			<Text>{`Vi hjelper gjerne til med å få den på plass. Svar på denne e-posten eller skriv til ${JOB_LISTING_ORDER_EMAIL} hvis dere har spørsmål.`}</Text>
		</OrderLayout>
	);
}

JobListingOrderRejectedEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	reference: "JL-2026-0001",
	reason: "Søknadslenken virker ikke.",
};
