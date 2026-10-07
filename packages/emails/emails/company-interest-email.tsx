import { Text } from "react-email";
import { OrderLayout, OrderSummary } from "../components/order-layout.js";

/** To Navet: a company wants to know when applications for bedriftspresentasjoner open. */
export default function CompanyInterestEmail({
	companyName,
	email,
}: Readonly<{ companyName: string; email: string }>) {
	return (
		<OrderLayout preview={`${companyName} vil vite når søknadene åpner`} showSignature={false}>
			<Text>{`${companyName} vil ha beskjed når søknadene om bedriftspresentasjon åpner. Svar på denne e-posten for å skrive til dem.`}</Text>
			<OrderSummary
				rows={[
					["Bedrift", companyName],
					["E-post", email],
				]}
			/>
		</OrderLayout>
	);
}

CompanyInterestEmail.PreviewProps = {
	companyName: "Fjordkode AS",
	email: "ingrid@fjordkode.no",
};
