import {
	Container,
	Font,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Preview,
	pixelBasedPreset,
	Tailwind,
	Text,
} from "@react-email/components";

export default function AvailableSeatEmail({
	event,
	url,
}: Readonly<{ event: string; url: string }>) {
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
								primary: "#2f3e5f",
							},
						},
					},
				}}
			>
				<Container className="mx-auto my-auto w-full max-w-[600px] px-4 py-8">
					<Img
						src="https://gallant-pheasant-518.convex.cloud/api/storage/6aa758e2-ee53-449a-af69-9534518f3d6c"
						alt="Navet Logo"
						height="50px"
						className="pb-4"
					/>

					<Heading as="h1" className="text-primary dark:text-primary-light">
						Du har fått mulighet til å bli med på "{event}", vennligst bekreft til deltagelse!
					</Heading>

					<Text className="text-lg">
						Du har nå 16 timer på deg til å godta tilbudet om plass. Hvis ikke så vil du bli flyttet
						tilbake på venstelisten, og havne nederst.
					</Text>

					<Text className="pt-4">
						<a href={url}>Trykker her for å godta eller avslå tilbudet om plass</a>
						<br />
						<br />
						Dersom det ikke funker å trykke på lenken, kan du kopiere og lime inn denne lenken i
						nettleseren din: <br />
						{url}
					</Text>

					<Hr />

					<Text className="py-4 text-gray-700 text-sm">
						Dersom du mener at dette er en feil kan du svare på eposten, eller sende en epost til{" "}
						<a href="mailto:arrangement@ifinavet.no">arrangement@finavet.no</a>
					</Text>

					<Text className="pt-16 text-center text-gray-400 text-lg leading-[18px]">
						© {new Date().getFullYear()} IFI-Navet
					</Text>
				</Container>
			</Tailwind>
		</Html>
	);
}
