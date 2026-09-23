import { Text } from "react-email";
import { CompanyEmailLayout } from "../components/company-email-layout.js";

export default function CompanyOfferConfirmedEmail({
	companyName,
	dateLabel,
}: Readonly<{ companyName: string; dateLabel: string }>) {
	return (
		<CompanyEmailLayout
			preview={`${companyName} er bekreftet ${dateLabel}`}
			heading="Datoen er bekreftet"
		>
			<Text className="text-lg">
				Takk! {companyName} har fått {dateLabel}. Deres kontaktperson i Navet tar kontakt 4–5 uker
				før arrangementet.
			</Text>
		</CompanyEmailLayout>
	);
}
