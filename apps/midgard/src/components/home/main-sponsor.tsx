import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import Image from "next/image";
import Link from "next/link";
import SafeHtml from "../common/sanitize-html";

export default async function MainSponsorCard({ className }: Readonly<{ className?: string }>) {
	const mainSponsor = await fetchQuery(api.companies.getMainSponsor);

	return (
		<div className={cn(className, "space-y-4")}>
			<h1 className="hyphens-manual text-balance font-bold text-4xl text-primary tracking-tight dark:text-primary-foreground">
				Hoved&shy;samarbeids&shy;partner
			</h1>
			<div className="flex flex-col items-center gap-6 rounded-xl bg-primary-light px-4 py-16 md:px-8 lg:flex-row dark:bg-gray-800">
				<div className="grid aspect-square size-32 place-content-center rounded-full border-2 border-neutral-300 bg-white">
					{mainSponsor?.imageUrl && (
						<Image
							src={mainSponsor.imageUrl}
							alt={mainSponsor.name}
							width={200}
							height={200}
							className="h-auto p-8"
							loading="eager"
						/>
					)}
				</div>
				<div className="flex h-full flex-col justify-start gap-2">
					<h1 className="font-bold text-4xl text-primary dark:text-primary-foreground">
						{mainSponsor?.name}
					</h1>
					<SafeHtml
						html={mainSponsor?.description || ""}
						className="prose text-primary dark:text-primary-foreground"
					/>
					<Button
						variant="default"
						size="lg"
						className="-mb-4 mt-2 w-fit text-end dark:bg-primary-light dark:text-primary"
						asChild
					>
						<Link href={`/job-listings?company=${mainSponsor?._id ?? ""}`}>
							Se våre stillingsannonser
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
