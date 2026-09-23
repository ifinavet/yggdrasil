import { Text } from "react-email";
import {
	CompanyEmailLayout,
	SummaryBox,
	type SummaryRow,
} from "../components/company-email-layout.js";

export default function ApplicationReceiptEmail({
	companyName,
	semesterLabel,
	rows,
}: Readonly<{ companyName: string; semesterLabel: string; rows: SummaryRow[] }>) {
	return (
		<CompanyEmailLayout
			preview={`Vi har mottatt søknaden fra ${companyName}`}
			heading="Søknaden er sendt"
		>
			<Text className="text-lg">
				Takk! Vi har mottatt søknaden om bedriftsarrangement for {semesterLabel}. Etter fristen
				fordeler vi datoene og sender dere et tilbud på e-post.
			</Text>

			<SummaryBox title="Dette sendte dere" rows={rows} />
		</CompanyEmailLayout>
	);
}
