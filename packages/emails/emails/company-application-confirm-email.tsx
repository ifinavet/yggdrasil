import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { CONFIRM_EMAIL_DEFAULTS, confirmEmailFor } from "@workspace/shared/semester/confirm-email";
import { Link, Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

/**
 * The link that confirms a bedpres application. The paragraphs are the semester's own text or the
 * default; the button and the line with the link always follow them.
 */
export default function CompanyApplicationConfirmEmail({
	subject,
	paragraphs,
	url,
}: Readonly<{ subject: string; paragraphs: readonly string[]; url: string }>) {
	return (
		<OrderLayout preview={subject} contactEmail={COMPANY_CONTACT_EMAIL}>
			{paragraphs.map((paragraph, index) => (
				<Text key={`${index}-${paragraph.slice(0, 20)}`} style={{ whiteSpace: "pre-line" }}>
					{paragraph}
				</Text>
			))}
			<Section style={{ margin: "24px 0" }}>
				<OrderButton href={url}>Bekreft søknaden</OrderButton>
			</Section>
			<Text>
				Lenken virker i 24 timer. Virker ikke knappen, kan dere lime inn denne lenken i nettleseren:{" "}
				<Link href={url}>{url}</Link>
			</Text>
		</OrderLayout>
	);
}

CompanyApplicationConfirmEmail.PreviewProps = {
	subject: CONFIRM_EMAIL_DEFAULTS.subject,
	paragraphs: confirmEmailFor(null, "FJORDKODE AS").paragraphs,
	url: "https://hugin.ifinavet.no/bestill-bedpres/bekreft#token=example",
};
