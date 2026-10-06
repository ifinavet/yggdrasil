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
	reminder = false,
	changed = false,
}: Readonly<{
	firstName: string;
	periodTitle: string;
	when: string;
	room: string;
	applicationUrl: string;
	reminder?: boolean;
	changed?: boolean;
}>) {
	const variant = (reminder && "reminder") || (changed && "changed") || "invite";
	const copy = {
		reminder: {
			preview: "Påminnelse om intervju",
			intro: `Dette er en påminnelse om intervjuet ditt for ${periodTitle}.`,
		},
		changed: {
			preview: "Ny intervjutid",
			intro: `Intervjuet ditt for ${periodTitle} har fått ny tid. Den gamle tiden gjelder ikke lenger.`,
		},
		invite: {
			preview: "Intervju",
			intro: `Vi vil gjerne invitere deg til intervju i forbindelse med ${periodTitle}.`,
		},
	}[variant];
	return (
		<OrderLayout preview={`${copy.preview} for ${periodTitle}`} contactEmail={EVENT_CONTACT_EMAIL}>
			<Text>{`Hei ${firstName},`}</Text>
			<Text>{copy.intro}</Text>
			<Section style={{ backgroundColor: "#f6f7f9", padding: "16px" }}>
				<Text>{`Tid: ${when}`}</Text>
				<Text>
					Sted: <Link href={roomUrl(room)}>{room}</Link>
				</Text>
			</Section>
			<Text>
				{reminder ? "Vi gleder oss til å prate med deg." : "Vi gleder oss til å bli kjent med deg."}{" "}
				Bruk lenken nedenfor hvis du vil se eller avlyse intervjuet.
			</Text>
			<OrderButton href={applicationUrl}>Se eller avlys intervjuet</OrderButton>
		</OrderLayout>
	);
}
