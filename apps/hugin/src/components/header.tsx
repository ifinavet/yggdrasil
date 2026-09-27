"use client";

import { MIDGARD_URL } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import Header from "@workspace/ui/components/header";
import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HuginHeader() {
	const pathname = usePathname();
	if (pathname === "/report") return null;
	return (
		<Header
			homeHref={MIDGARD_URL}
			sticky={false}
			navigation={
				<Button asChild size="icon" variant="link" className="text-primary-foreground">
					<Link href={`${MIDGARD_URL}/profile`} aria-label="Profil">
						<CircleUserRound className="size-6" />
					</Link>
				</Button>
			}
		/>
	);
}
