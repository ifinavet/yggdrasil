import type { ReactNode } from "react";
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
	Section,
	Tailwind,
	Text,
} from "react-email";

export type SummaryRow = { label: string; value: string };

/** The frame shared by the emails companies get about semester planning. */
export function CompanyEmailLayout({
	preview,
	heading,
	children,
}: Readonly<{ preview: string; heading: string; children: ReactNode }>) {
	return (
		<Html lang="no">
			<Head>
				<Font fontFamily="Helvetica" fallbackFontFamily="sans-serif" />
			</Head>

			<Preview>{preview}</Preview>

			<Tailwind
				config={{
					presets: [pixelBasedPreset],
					theme: { extend: { colors: { primary: "#2f3e5f" } } },
				}}
			>
				<Container className="mx-auto my-auto w-full max-w-[600px] px-4 py-8">
					<Img
						src="https://gallant-pheasant-518.convex.cloud/api/storage/6aa758e2-ee53-449a-af69-9534518f3d6c"
						alt="Navet Logo"
						height="50px"
						className="pb-4"
					/>

					<Heading as="h1" className="text-primary">
						{heading}
					</Heading>

					{children}

					<Hr />

					<Text className="py-4 text-gray-700 text-sm">
						Spørsmål? Svar på denne e-posten, eller skriv til{" "}
						<a href="mailto:bedrift@ifinavet.no">bedrift@ifinavet.no</a>.
					</Text>

					<Text className="pt-16 text-center text-gray-400 text-lg leading-[18px]">
						© {new Date().getFullYear()} IFI-Navet
					</Text>
				</Container>
			</Tailwind>
		</Html>
	);
}

/** A bordered list of label: value rows, e.g. what the company sent or was offered. */
export function SummaryBox({ title, rows }: Readonly<{ title: string; rows: SummaryRow[] }>) {
	return (
		<Section className="rounded-lg border border-gray-200 border-solid px-4 py-2">
			<Text className="font-bold text-gray-600 text-sm">{title}</Text>
			{rows.map((row) => (
				<Text key={row.label} className="my-1 text-sm">
					<span className="text-gray-500">{row.label}: </span>
					{row.value}
				</Text>
			))}
		</Section>
	);
}
