import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import {
	Button,
	Container,
	Font,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	pixelBasedPreset,
	Section,
	Tailwind,
	Text,
} from "react-email";
import { BRAND_PRIMARY_COLOR, NAVET_LOGO_URL } from "../constants.js";

export default function AvailableSeatEmail({
	event,
	url,
}: Readonly<{ event: string; url: string }>) {
	const acceptUrl = new URL(url);
	acceptUrl.searchParams.set("response", "accept");
	const declineUrl = new URL(url);
	declineUrl.searchParams.set("response", "decline");

	return (
		<Html lang="no">
			<Head>
				<Font fontFamily="Helvetica" fallbackFontFamily="sans-serif" />
			</Head>

			<Preview>Det er blitt en ledig plass på {event}, vennligst bekreft din deltagelse</Preview>

			<Tailwind
				config={{
					presets: [pixelBasedPreset],
					theme: {
						extend: {
							colors: {
								primary: BRAND_PRIMARY_COLOR,
							},
						},
					},
				}}
			>
				<Container className="mx-auto my-auto w-full max-w-[600px] px-4 py-8">
					<Img src={NAVET_LOGO_URL} alt="Navet Logo" height="50px" className="pb-4" />

					<Heading as="h1" className="text-primary dark:text-primary-light">
						Du har fått mulighet til å bli med på "{event}", vennligst bekreft din deltagelse!
					</Heading>

					<Text className="text-lg">
						Du har nå 24 timer på deg til å godta tilbudet om plass. Hvis ikke så vil du bli flyttet
						tilbake på ventelisten og havne nederst.
					</Text>

					<Text className="text-lg">
						Vil du ha plassen? Velg ja eller nei og bekreft på nettsiden. Du må være logget inn.
						Takker du nei, går plassen videre til den neste på ventelisten.
					</Text>

					<Section className="py-4">
						<Button
							href={acceptUrl.toString()}
							className="mb-3 block rounded-md bg-primary px-6 py-4 font-semibold text-base text-white"
						>
							Ja, jeg vil ha plassen
						</Button>
						<Button
							href={declineUrl.toString()}
							className="block rounded-md bg-red-700 px-6 py-4 font-semibold text-base text-white"
						>
							Nei, gi plassen videre
						</Button>
					</Section>

					<Text className="pt-4">
						<a href={url}>Åpne tilbudet og svar på nettsiden</a>
						<br />
						<br />
						Dersom det ikke funker å trykke på lenken, kan du kopiere og lime inn denne lenken i
						nettleseren din: <br />
						{url}
					</Text>

					<Text className="py-4 text-gray-700 text-sm">
						Dersom du mener at dette er en feil kan du svare på eposten, eller sende en epost til{" "}
						<a href={`mailto:${EVENT_CONTACT_EMAIL}`}>{EVENT_CONTACT_EMAIL}</a>
					</Text>
				</Container>
			</Tailwind>
		</Html>
	);
}

AvailableSeatEmail.PreviewProps = {
	event: "Bedriftspresentasjon med Eksempel AS",
	url: "https://ifinavet.no/events/example/registration/example-registration",
};
