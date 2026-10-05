import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { roomUrl } from "@workspace/shared/constants/urls";
import { Link, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function AdmissionsReminderEmail({
	firstName,
	periodTitle,
	when,
	room,
	applicationUrl,
}: Readonly<{
	firstName: string;
	periodTitle: string;
	when: string;
	room: string;
	applicationUrl: string;
}>) {
	return (
		<OrderLayout
			preview={`Påminnelse om intervju for ${periodTitle}`}
			contactEmail={EVENT_CONTACT_EMAIL}
		>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Dette er en påminnelse om intervjuet ditt for ${periodTitle}.`}</Text>
			<Text>{`Tid: ${when}`}</Text>
			<Text>
				Sted: <Link href={roomUrl(room)}>{room}</Link>
			</Text>
			<Text>
				Vi gleder oss til å prate med deg! Du kan avlyse intervjuet i Hugin hvis du ikke kan møte.
			</Text>
			<OrderButton href={applicationUrl}>Se intervjuet ditt</OrderButton>
		</OrderLayout>
	);
}
