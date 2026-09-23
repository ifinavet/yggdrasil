import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from "react-email";

export default function FeedbackEmail({
	event,
	url,
	reminder,
}: Readonly<{ event: string; url: string; reminder: boolean }>) {
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
					<Text style={{ fontWeight: "bold" }}>IFI-Navet</Text>
					<Heading as="h1">Hva syntes du om {event}?</Heading>
					<Text>
						{reminder
							? "Vi vil gjerne høre hva du syntes. Tilbakemeldingen din hjelper oss å lage bedre arrangementer."
							: "Takk for at du deltok! Fortell oss hva som fungerte bra, og hva vi kan gjøre bedre."}
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
					<Text>Lenken er personlig. Svarene dine er knyttet til deg og kan leses av Navet.</Text>
					<Hr />
					<Text>
						Fungerer ikke knappen? <Link href={url}>Åpne tilbakemeldingsskjemaet her.</Link>
					</Text>
					<Text>
						Har du spørsmål, kan du svare på denne e-posten eller kontakte{" "}
						<Link href="mailto:arrangement@ifinavet.no">arrangement@ifinavet.no</Link>.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}
