import ContainerCard from "@/components/cards/container-card";
import type { EventRegistrationSummary } from "./registration-summary";

export default function WaitlistPosition({
	className,
	registrationSummary,
}: Readonly<{
	className?: string;
	registrationSummary: EventRegistrationSummary;
}>) {
	const { ownWaitlistPosition } = registrationSummary;

	if (!ownWaitlistPosition) return null;

	return (
		<ContainerCard className={className}>
			<p className="not-first:mt-6 leading-7">
				Du står på venteliste for dette arrangementet. Dersom det blir en ledig plass til deg så vil
				du mota en e-post, du har da 24 timer på å godta tilbudet om å bli med på arrangementet.
			</p>
			<p className="font-semibold text-lg">Du er nr. {ownWaitlistPosition} på ventelisten.</p>
		</ContainerCard>
	);
}
