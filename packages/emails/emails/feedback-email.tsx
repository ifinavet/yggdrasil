import { MIDGARD_URL } from "@workspace/shared/constants/urls";
import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Text,
} from "react-email";
import { NAVET_LOGO_URL } from "../constants.js";

const CONTACT_URL = `${MIDGARD_URL}/contact`;

export default function FeedbackEmail({
	companyName,
	signature,
	url,
	reminder,
}: Readonly<{
	companyName: string;
	signature: { name: string; email: string };
	url: string;
	reminder: boolean;
}>) {
	return (
		<Html lang="no">
			<Head />
			<Preview>
				{reminder ? "Husk å dele din tilbakemelding" : "Hva syntes du om arrangementet?"}
			</Preview>
			<Body
				style={{
					backgroundColor: "#f6f7f9",
					fontFamily: "Helvetica, Arial, sans-serif",
					color: "#17395c",
				}}
			>
				<Container style={{ backgroundColor: "#ffffff", padding: "32px", maxWidth: "560px" }}>
					<Img src={NAVET_LOGO_URL} alt="Navet" height="40" />
					<Text>Hei,</Text>
					<Text>{`Takk for deltakelse på bedriftspresentasjonen med ${companyName}!`}</Text>
					<Text>
						For å forbedre bedriftspresentasjonene må du fylle ut et obligatorisk
						tilbakemeldingsskjema
					</Text>
					<Button
						href={url}
						style={{
							backgroundColor: "#17395c",
							color: "#ffffff",
							padding: "14px 20px",
							borderRadius: "6px",
						}}
					>
						Gi tilbakemelding
					</Button>
					<Text>
						Etter at du har svart på tilbakemeldingsskjemaet er du med på trekningen av en premie
						med verdi på <strong>2000 kr!</strong> Vi trekker den heldige vinneren etter den siste
						bedriftspresentasjonen for det semesteret.
					</Text>
					<Text>En siste takk til deg for at du deltar på Navet sine arrangementer!</Text>
					<Heading as="h2" style={{ fontSize: "18px" }}>
						Opplevd noe ugreit?
					</Heading>
					<Text>
						Har du andre tilbakemeldinger til Navet, eller opplevd noe ugreit oppfordrer vi deg til
						å gi oss tilbakemelding her: <Link href={CONTACT_URL}>{CONTACT_URL}</Link>
					</Text>
					<Text style={{ margin: "32px 0 0" }}>Med vennlig hilsen,</Text>
					<Text style={{ margin: "16px 0 0" }}>
						{signature.name}
						<br />
						<Link href={`mailto:${signature.email}`}>{signature.email}</Link>
					</Text>
					<Img src={NAVET_LOGO_URL} alt="Navet" height="32" style={{ marginTop: "16px" }} />
				</Container>
			</Body>
		</Html>
	);
}
