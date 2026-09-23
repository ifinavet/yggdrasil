import { Text } from "react-email";
import {
	CompanyEmailLayout,
	SummaryBox,
	type SummaryRow,
} from "../components/company-email-layout.js";

/** Tells the bedriftskontakt that a company answered an offer. */
export default function OfferResponseNoticeEmail({
	companyName,
	answer,
	rows,
}: Readonly<{
	companyName: string;
	answer: "accepted" | "new_date_requested";
	rows: SummaryRow[];
}>) {
	const heading =
		answer === "accepted"
			? `${companyName} har godtatt tilbudet`
			: `${companyName} ber om en annen dato`;

	return (
		<CompanyEmailLayout preview={heading} heading={heading}>
			<Text className="text-lg">
				{answer === "accepted"
					? "Søknaden er nå bekreftet i Bifrost."
					: "Tildel en ny dato i Bifrost og send et nytt tilbud."}
			</Text>
			<SummaryBox title="Svaret" rows={rows} />
		</CompanyEmailLayout>
	);
}
