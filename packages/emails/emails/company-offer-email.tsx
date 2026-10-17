import { COMPANY_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function CompanyOfferEmail({
	firstName,
	day,
	url,
}: Readonly<{ firstName: string; day: string; url: string }>) {
	return (
		<OrderLayout
			preview={`Tilbud om bedriftsarrangement ${day}`}
			contactEmail={COMPANY_CONTACT_EMAIL}
		>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Takk for søknaden! Vi har gleden av å tilby dere ${day} til arrangementet deres.`}</Text>
			<Section style={{ margin: "24px 0" }}>
				<OrderButton href={url}>Se tilbudet og svar</OrderButton>
			</Section>
			<Text>
				Der kan dere godta datoen, be om en annen dato eller takke nei. Lurer dere på noe? Bare svar
				på denne e-posten. Vi gleder oss til å høre fra dere!
			</Text>
		</OrderLayout>
	);
}

CompanyOfferEmail.PreviewProps = {
	firstName: "Kari",
	day: "tirsdag 9. februar",
	url: "https://hugin.ifinavet.no/bestill-bedpres/tilbud/abc",
};
