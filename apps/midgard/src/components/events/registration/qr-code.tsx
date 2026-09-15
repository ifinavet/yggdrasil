import { QRCodeSVG } from "qrcode.react";
import ContainerCard from "@/components/cards/container-card";
import type { EventRegistrationSummary } from "./registration-summary";

export default function QRCode({
	className,
	registrationSummary,
}: Readonly<{
	className?: string;
	registrationSummary: EventRegistrationSummary;
}>) {
	const { ownRegistration } = registrationSummary;

	if (!ownRegistration || ownRegistration.status === "waitlist") return null;

	return (
		<ContainerCard className={className}>
			<div className="mx-auto overflow-clip rounded-lg bg-zinc-100 p-4">
				<QRCodeSVG value={ownRegistration._id} size={256} fgColor="#2f3e5f" bgColor="#f4f4f5" />
			</div>
		</ContainerCard>
	);
}
