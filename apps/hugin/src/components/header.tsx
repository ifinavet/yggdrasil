import { Button } from "@workspace/ui/components/button";
import Header from "@workspace/ui/components/header";
import { midgardUrl } from "@workspace/ui/lib/urls";
import { CircleUserRound } from "lucide-react";
import Link from "next/link";

export default function HuginHeader() {
	return (
		<Header
			homeHref={midgardUrl}
			navigation={
				<Button asChild size="icon" variant="link" className="text-primary-foreground">
					<Link href={`${midgardUrl}/profile`} aria-label="Profil">
						<CircleUserRound className="size-6" />
					</Link>
				</Button>
			}
		/>
	);
}
