import { BIFROST_URL } from "@workspace/shared/constants/urls";
import {
	Button,
	Container,
	Font,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Preview,
	pixelBasedPreset,
	Section,
	Tailwind,
	Text,
} from "react-email";
import { BRAND_PRIMARY_COLOR, NAVET_LOGO_URL } from "../constants.js";

export type WorkspaceWelcomeEmailProps = Readonly<{
	firstName: string;
	workspaceEmail: string;
	temporaryPassword?: string;
	slackInviteLink?: string;
}>;

export default function WorkspaceWelcomeEmail({
	firstName,
	workspaceEmail,
	temporaryPassword,
	slackInviteLink,
}: WorkspaceWelcomeEmailProps) {
	return (
		<Html lang="no">
			<Head>
				<Font fontFamily="Helvetica" fallbackFontFamily="sans-serif" />
			</Head>

			<Preview>Velkommen til Navet, her er kontoen din.</Preview>

			<Tailwind
				config={{
					presets: [pixelBasedPreset],
					theme: { extend: { colors: { primary: BRAND_PRIMARY_COLOR } } },
				}}
			>
				<Container className="mx-auto my-auto w-full max-w-[600px] px-4 py-8">
					<Img src={NAVET_LOGO_URL} alt="Navet Logo" height="50px" className="pb-4" />

					<Heading as="h1" className="text-primary">
						Velkommen til Navet, {firstName}
					</Heading>

					<Text className="text-lg">
						Du har fått en Navet-konto. Den bruker du til e-post, Google Drive og for å logge inn i
						Bifrost.
					</Text>

					<Section className="rounded-md bg-gray-100 px-4 py-2">
						<Text className="m-0 text-gray-600 text-sm">E-post</Text>
						<Text className="mt-0 font-bold text-lg">{workspaceEmail}</Text>
						{temporaryPassword ? (
							<>
								<Text className="m-0 text-gray-600 text-sm">Midlertidig passord</Text>
								<Text className="mt-0 font-bold font-mono text-lg">{temporaryPassword}</Text>
							</>
						) : (
							<Text className="text-gray-700">
								Du har allerede en konto med denne adressen, så passordet ditt er det samme som før.
							</Text>
						)}
					</Section>

					{temporaryPassword ? (
						<Text>
							Logg inn på gmail.com med adressen over. Du blir bedt om å velge et nytt passord
							første gang.
						</Text>
					) : null}

					<Text>
						Når du har logget inn på Google, logger du inn i Bifrost med samme konto. Da får du
						tilgang automatisk.
					</Text>

					<Button href={BIFROST_URL} className="rounded-md bg-primary px-5 py-3 text-white">
						Åpne Bifrost
					</Button>

					{slackInviteLink ? (
						<Text className="pt-4">
							Bli med i Slack med Navet-adressen din:{" "}
							<a href={slackInviteLink} className="text-primary underline">
								bli med i Slack
							</a>
							{"."}
						</Text>
					) : null}

					<Hr />

					<Text className="py-4 text-gray-700 text-sm">
						Har du spørsmål, kan du svare på denne e-posten.
					</Text>

					<Text className="pt-16 text-center text-gray-400 text-lg leading-[18px]">
						© {new Date().getFullYear()} IFI-Navet
					</Text>
				</Container>
			</Tailwind>
		</Html>
	);
}

WorkspaceWelcomeEmail.PreviewProps = {
	firstName: "Ola",
	workspaceEmail: "ola.nordmann@ifinavet.no",
	temporaryPassword: "Midlertidig-passord",
	slackInviteLink: "https://join.slack.com/t/ifinavet/shared_invite/eksempel",
} satisfies WorkspaceWelcomeEmailProps;
