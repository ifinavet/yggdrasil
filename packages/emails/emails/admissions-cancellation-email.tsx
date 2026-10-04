import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Text } from "react-email";
import { OrderLayout } from "../components/order-layout.js";

export default function AdmissionsCancellationEmail({
	firstName,
	periodTitle,
	when,
}: Readonly<{ firstName: string; periodTitle: string; when: string }>) {
	return (
		<OrderLayout
			preview={`Intervjuet for ${periodTitle} er avlyst`}
			contactEmail={EVENT_CONTACT_EMAIL}
		>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Intervjuet ditt for ${periodTitle}, planlagt ${when}, er avlyst.`}</Text>
			<Text>Vi beklager endringen. Vi tar kontakt hvis vi kan tilby et nytt tidspunkt.</Text>
		</OrderLayout>
	);
}

AdmissionsCancellationEmail.PreviewProps = {
	firstName: "Kari",
	periodTitle: "Høstopptak 2026",
	when: "mandag 12. oktober kl. 10:00",
};
