import { EVENT_CONTACT_EMAIL } from "@workspace/shared/constants/contact";
import { roomUrl } from "@workspace/shared/constants/urls";
import { Link, Section, Text } from "react-email";
import { OrderButton, OrderLayout } from "../components/order-layout.js";

export default function AdmissionsInterviewEmail({
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
		<OrderLayout preview={`Intervju for ${periodTitle}`} contactEmail={EVENT_CONTACT_EMAIL}>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{`Vi vil gjerne invitere deg til intervju i forbindelse med ${periodTitle}.`}</Text>
			<Section style={{ backgroundColor: "#f6f7f9", padding: "16px" }}>
				<Text>{`Tid: ${when}`}</Text>
				<Text>
					Sted: <Link href={roomUrl(room)}>{room}</Link>
				</Text>
			</Section>
			<Text>
				Vi gleder oss til å bli kjent med deg. Bruk lenken nedenfor hvis du vil se eller avlyse
				intervjuet.
			</Text>
			<OrderButton href={applicationUrl}>Se eller avlys intervjuet</OrderButton>
		</OrderLayout>
	);
}
