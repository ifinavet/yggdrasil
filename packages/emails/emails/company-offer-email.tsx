import { Button, Text } from "react-email";
import {
	CompanyEmailLayout,
	SummaryBox,
	type SummaryRow,
} from "../components/company-email-layout.js";

export default function CompanyOfferEmail({
	contactName,
	companyName,
	dateLabel,
	eventTypeLabel,
	maxStudents,
	url,
	respondByLabel,
}: Readonly<{
	contactName: string;
	companyName: string;
	dateLabel: string;
	eventTypeLabel: string;
	maxStudents: number;
	url: string;
	respondByLabel?: string;
}>) {
	const rows: SummaryRow[] = [
		{ label: "Dato", value: dateLabel },
		{ label: "Type", value: eventTypeLabel },
		{ label: "Studenter", value: `Opptil ${maxStudents}` },
	];

	return (
		<CompanyEmailLayout preview={`Tilbud om ${dateLabel}`} heading="Vi har en dato til dere">
			<Text className="text-lg">Hei {contactName},</Text>
			<Text className="text-lg">
				Vi i Navet ønsker å tilby {companyName} {dateLabel} for {eventTypeLabel.toLowerCase()} med
				opptil {maxStudents} studenter. Høres det greit ut?
			</Text>

			<SummaryBox title="Tilbudet" rows={rows} />

			<Button href={url} className="my-6 rounded-lg bg-primary px-6 py-3 font-bold text-white">
				Se tilbudet og svar
			</Button>

			<Text className="text-gray-600 text-sm">
				{respondByLabel ? `Svar innen ${respondByLabel}. ` : ""}Når dere godtar datoen, godtar dere
				også standardvilkårene for bedriftsarrangement.
			</Text>
			<Text className="text-gray-600 text-sm">
				Fungerer ikke knappen? Kopier denne lenken inn i nettleseren: {url}
			</Text>
		</CompanyEmailLayout>
	);
}
