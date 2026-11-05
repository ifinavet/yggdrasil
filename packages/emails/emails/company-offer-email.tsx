import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { offerEmailFor } from "@workspace/shared/semester/company-emails";
import { Link, Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

/**
 * The link to an offered bedpres date. The paragraphs are the semester's own text or the default;
 * the button and the lines about answering always follow them.
 */
export default function CompanyOfferEmail({
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
				<OrderButton href={url}>Se tilbudet og svar</OrderButton>
			</Section>
			<Text>Der kan dere godta datoen, be om en annen dato eller takke nei.</Text>
			<Text>
				Virker ikke knappen, kan dere lime inn denne lenken i nettleseren:{" "}
				<Link href={url}>{url}</Link>
			</Text>
		</OrderLayout>
	);
}

CompanyOfferEmail.PreviewProps = {
	...offerEmailFor(null, {
		companyName: "FJORDKODE AS",
		firstName: "Kari",
		day: "tirsdag 9. februar 2027",
	}),
	url: "https://hugin.ifinavet.no/bestill-bedpres/tilbud/abc",
};
