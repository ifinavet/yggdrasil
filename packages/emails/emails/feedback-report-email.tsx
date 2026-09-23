import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Section,
	Text,
} from "react-email";
import { BRAND_PRIMARY_COLOR } from "../constants.js";

export default function FeedbackReportEmail({
	eventDate,
	url,
	logoUrl,
}: Readonly<{ eventDate: string; url: string; logoUrl: string }>) {
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
					<Section style={{ backgroundColor: BRAND_PRIMARY_COLOR, padding: "24px 34px" }}>
						<Img
							src={logoUrl}
							alt="Navet"
							height="34"
							style={{ width: "auto", filter: "brightness(0) invert(1)" }}
						/>
					</Section>
					<Section style={{ padding: "34px" }}>
						<Heading as="h1" style={{ fontSize: "26px", lineHeight: "1.3", margin: "0 0 18px" }}>
							Takk for besøket!
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
						<Text
							style={{ color: "#6b6f7c", fontSize: "13px", lineHeight: "1.6", marginTop: "24px" }}
						>
							Lenken gir tilgang til rapporten. Del den bare med personer som skal ha tilgang.
						</Text>
						<Text style={{ color: "#6b6f7c", fontSize: "15px", marginTop: "26px" }}>
							Vennlig hilsen
							<br />
							Navet
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
