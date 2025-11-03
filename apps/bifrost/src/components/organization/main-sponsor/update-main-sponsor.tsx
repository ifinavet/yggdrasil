"use client";

import type { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import { Pencil } from "lucide-react";
import Link from "next/link";
import SafeHtml from "@/components/common/sanitize-html";
import UpdateMainSponsorForm from "./update-main-sponsor-form";

export default function UpdateMainSponsor({
	preloadedMainSponsor,
}: Readonly<{
	preloadedMainSponsor: Preloaded<typeof api.companies.getMainSponsor>;
}>) {
	const mainSponsor = usePreloadedQuery(preloadedMainSponsor);

	return (
		mainSponsor && (
			<div className="flex flex-wrap gap-4">
				<UpdateMainSponsorForm companyId={mainSponsor._id} />
				<Link href={`/companies/${mainSponsor._id}`} className="max-w-lg">
					<Card>
						<CardHeader>
							<CardTitle>{mainSponsor.name}</CardTitle>
							<CardAction>
								<Button variant="outline" size="icon">
									<Pencil />
								</Button>
							</CardAction>
						</CardHeader>
						<CardContent className="line-clamp-5">
							{mainSponsor.description && (
								<SafeHtml
									html={mainSponsor.description}
									className="prose dark:prose-invert overflow-clip"
								/>
							)}
						</CardContent>
						<CardFooter>
							<p>Org. nr: {mainSponsor.orgNumber ?? "N/A"}</p>
						</CardFooter>
					</Card>
				</Link>
			</div>
		)
	);
}
