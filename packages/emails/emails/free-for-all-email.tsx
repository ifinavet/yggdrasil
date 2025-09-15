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

export default function FreeForAllEmail({ event, url, availableSeats }: Readonly<{ event: string, url: string, availableSeats: number }>) {
	return (
		<Html lang='no'>
			<Head>
				<Font fontFamily='Helvetica' fallbackFontFamily='sans-serif' />
			</Head>

			<Preview>
				Det er er {`${availableSeats}`} ledige plasser!
			</Preview>

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
				<Container className='mx-auto my-auto w-full max-w-[600px] px-4 py-8'>
					<Img
						src='https://gallant-pheasant-518.convex.cloud/api/storage/6aa758e2-ee53-449a-af69-9534518f3d6c'
						alt='Navet Logo'
						height='50px'
						className='pb-4'
					/>

					<Heading as='h1' className='text-primary dark:text-primary-light'>
						Det er {availableSeats} ledige plasser på "{event}"!
					</Heading>

					<Text className='text-lg'>
						Det er første mann til mølla, dersom plassene er tatt så kan du sette deg på venteliste.
					</Text>

					<Text className='pt-4'>
						<a href={url}>Trykker her for å gå til arrangementet</a>
						<br />
						<br />
						Dersom det ikke funker å trykke på lenken, kan du kopiere og lime inn denne lenken i nettleseren din: <br />
						{url}
					</Text>

					<Text className='pt-4'>
						Hvis du ikke ønsker å delta, kan du ignorere denne eposten.
					</Text>

					<Hr />

					<Text className='py-4 text-gray-700 text-sm'>
						Dersom du mener at dette er en feil kan du svare på eposten, eller sende en epost til{" "}
						<a href='mailto:arrangement@ifinavet.no'>arrangement@ifinavet.no</a>
					</Text>

					<Text className='pt-16 text-center text-gray-400 text-lg leading-[18px]'>
						© {new Date().getFullYear()} IFI-Navet
					</Text>
				</Container>
			</Tailwind>
		</Html>
	);
}
