"use client";

import { Button } from "@workspace/ui/components/button";
import Header from "@workspace/ui/components/header";
import { midgardUrl } from "@workspace/ui/lib/urls";
import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HuginHeader() {
	const pathname = usePathname();
	if (pathname === "/report") return null;
	return (
		<Header
			homeHref={midgardUrl}
			sticky={false}
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
