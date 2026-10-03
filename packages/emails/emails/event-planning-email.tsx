import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { splitPlanningEmail } from "@workspace/shared/events/planning-email";
import { Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function EventPlanningEmail({
	subject,
	text,
	url,
	confirmation,
}: Readonly<{ subject: string; text: string; url: string; confirmation: boolean }>) {
	const { body, signature } = splitPlanningEmail(text);
	return (
		<OrderLayout preview={subject} contactEmail={COMPANY_CONTACT_EMAIL} showSignature={false}>
			<Text style={{ whiteSpace: "pre-line", lineHeight: "1.7" }}>{body}</Text>
			<OrderButton href={url}>
				{confirmation ? "Bekreft opplysningene" : "Planlegg bedriftspresentasjon"}
			</OrderButton>
			{signature && <Text style={{ whiteSpace: "pre-line", lineHeight: "1.7" }}>{signature}</Text>}
		</OrderLayout>
	);
}
