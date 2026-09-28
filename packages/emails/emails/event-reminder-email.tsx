import { MIDGARD_URL } from "@workspace/shared/constants/urls";
import {
	Container,
	Font,
	Head,
	Hr,
	Html,
	Img,
	Preview,
	pixelBasedPreset,
	Tailwind,
	Text,
} from "react-email";
import { EmailSignature, type Signature } from "../components/email-signature.js";
import { BRAND_PRIMARY_COLOR, NAVET_LOGO_URL } from "../constants.js";

const POINTS_INFO_URL =
	"https://docs.google.com/document/u/2/d/1X11dY6OWjBactOVaTxnYpiQMo7ftHR374P3FGx0-XZc/edit?tab=t.0";
const GUIDELINES_URL = `${MIDGARD_URL}/info/retningslinjer`;

export default function EventReminderEmail({
	company,
	time,
	location,
	signature,
}: Readonly<{
	company: string;
	time: string;
	location: string;
	signature: Signature;
}>) {
	return (
		<Html lang="no">
			<Head>
				<Font fontFamily="Helvetica" fallbackFontFamily="sans-serif" />
			</Head>

			<Preview>
				Minner om at du er påmeldt til bedriftspresentasjon med {company} {time}
			</Preview>

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

					<Text>Hei!</Text>

					<Text>
						Minner om at du er påmeldt til bedriftspresentasjon med {company} {time} {location}.
					</Text>

					<Text>
						Hvis du ikke har mulighet til å bli med er det fint om du melder deg av så fort som
						mulig, slik at andre får mulighet til å melde seg på. Det vil bli sjekket om du har
						gyldig studentbevis, så husk å laste ned studentbevis-appen.
					</Text>

					<Text>
						<strong>OBS!</strong>
						<br />
						Arrangementer hvor det tildeles alkohol krever gyldig legitimasjon for å få tilgang til
						lokalet. Dette gjelder også adgang til studentbaren Escape!
					</Text>

					<Text>
						<strong>Prikksystem</strong>
						<br />
						Vi i Navet har et prikksystem for påmelding på bedriftspresentasjoner. Dette for å
						forhindre at mange melder seg av kort tid før bedriftspresentasjoner eller ikke møter
						opp når påmeldt.
						<br />
						Les mer om hvordan systemet fungerer her: <a href={POINTS_INFO_URL}>Info om prikker</a>
					</Text>

					<Text>
						<strong>VIKTIG!</strong>
						<br />
						Som deltaker på bedriftsarrangementet forventes det at du er til stede og deltar gjennom
						hele bedriftspresentasjonen/workshopen. Denne forpliktelsen gjelder kun for
						arrangementet i seg selv, og du er ikke forpliktet til å delta på eventuelle
						restaurantbesøk eller lignende som kan følge etterpå.
						<br />
						Hvis du bryter dette så vil det medfølge i 1 prikk.
					</Text>

					<Text>
						<strong>Retningslinjer</strong>
						<br />
						Som deltaker av Navets virksomhet plikter du å overholde retningslinjene. I tillegg til
						dette, forventes god oppførsel på arrangementene for at alle skal ha det fint.
						<br />
						Les våre retningslinjer her: <a href={GUIDELINES_URL}>Navet sine retningslinjer</a>
					</Text>

					<EmailSignature {...signature} />

					<Hr />

					<Text className="pt-16 text-center text-gray-400 text-lg leading-[18px]">
						© {new Date().getFullYear()} IFI-Navet
					</Text>
				</Container>
			</Tailwind>
		</Html>
	);
}
