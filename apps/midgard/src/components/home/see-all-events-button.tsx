import { Button } from "@workspace/ui/components/button";
import Link from "next/link";

export default function SeeAllEventsButton() {
	return (
		<Button
			asChild
			className="mx-8 bg-emerald-600 py-6 font-semibold text-primary-foreground hover:bg-emerald-700 md:mx-16"
		>
			<Link href={"/events"}>Se alle arrangementer</Link>
		</Button>
	);
}
