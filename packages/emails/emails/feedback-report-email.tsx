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
	Section,
	Text,
} from "react-email";
import { BRAND_PRIMARY_COLOR, NAVET_LOGO_URL } from "../constants.js";

export default function FeedbackReportEmail({
	eventDate,
	url,
	signature,
}: Readonly<{ eventDate: string; url: string; signature: { name: string; email: string } }>) {
	return (
		<Html lang="nb">
			<Head />
			<Preview>Tilbakemeldinger fra bedriftspresentasjonen deres</Preview>
			<Body
				style={{
					margin: 0,
					backgroundColor: "#f6f7f9",
					color: "#17181c",
					fontFamily: "Helvetica, Arial, sans-serif",
				}}
			>
				<Container
					style={{
						maxWidth: "600px",
						margin: "32px auto",
						backgroundColor: "#ffffff",
						borderRadius: "10px",
						overflow: "hidden",
					}}
				>
					<Section style={{ padding: "34px" }}>
						<Heading as="h1" style={{ fontSize: "26px", lineHeight: "1.3", margin: "0 0 18px" }}>
							Takk for denne gang!
						</Heading>
						<Text style={{ fontSize: "16px", lineHeight: "1.7" }}>
							Rapporten fra bedriftspresentasjonen deres {eventDate} er klar. Her finner dere
							deltakernes vurderinger og tilbakemeldinger.
						</Text>
						<Button
							href={url}
							style={{
								backgroundColor: BRAND_PRIMARY_COLOR,
								color: "#ffffff",
								padding: "12px 20px",
								borderRadius: "6px",
								marginTop: "8px",
							}}
						>
							Se rapporten
						</Button>
						<Text style={{ color: "#6b6f7c", fontSize: "15px", margin: "26px 0 10px" }}>
							Vennlig hilsen
						</Text>
						<Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
							{signature.name}
							<br />
							<Link href={`mailto:${signature.email}`}>{signature.email}</Link>
						</Text>
						<Img src={NAVET_LOGO_URL} alt="Navet" height="32" />
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
