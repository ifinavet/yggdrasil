import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function EventPlanningEmail({
	subject,
	text,
	url,
	confirmation,
}: Readonly<{ subject: string; text: string; url: string; confirmation: boolean }>) {
	return (
		<OrderLayout preview={subject} contactEmail={COMPANY_CONTACT_EMAIL} showSignature={false}>
			<Text style={{ whiteSpace: "pre-line", lineHeight: "1.7" }}>{text}</Text>
			<OrderButton href={url}>
				{confirmation ? "Bekreft opplysningene" : "Planlegg arrangementet"}
			</OrderButton>
		</OrderLayout>
	);
}
