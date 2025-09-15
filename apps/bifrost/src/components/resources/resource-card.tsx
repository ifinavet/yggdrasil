import type { Doc } from "@workspace/backend/convex/dataModel";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { cardColors, cardIcons } from "@/constants/resource-constants";

export default function ResourceCard({
	resource,
	className,
}: Readonly<{ resource: Doc<"resources">; className?: string }>) {
	const gradientKey = (resource.gradient ?? "blue") as keyof typeof cardColors;

	const iconKey =
		typeof resource.icon === "string" && resource.icon in cardIcons
			? (resource.icon as keyof typeof cardIcons)
			: "pencil";
	const IconComponent = cardIcons[iconKey];

	return (
		<Link href={`/resources/${resource._id}`} key={resource._id}>
			<Card
				key={resource._id}
				className={cn(
					className,
					"overflow-hidden border-0 py-0 pb-6 shadow-sm transition-shadow hover:shadow-md",
				)}
			>
				<div className={cn(`relative h-28 bg-gradient-to-r`, cardColors[gradientKey])}>
					<div className='-bottom-4 absolute left-6'>
						<div className='flex size-12 items-center justify-center rounded-xl bg-gray-600 shadow-lg dark:bg-gray-200'>
							<IconComponent className='size-6 text-white dark:text-black' />
						</div>
					</div>
				</div>
				<CardHeader className='pt-6'>
					<CardTitle className='font-semibold text-accent-foreground text-xl'>
						{resource.title}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<CardDescription className="text-primary leading-relaxed dark:text-primary-light">
						{resource.excerpt}
					</CardDescription>
				</CardContent>
			</Card>
		</Link>
	);
}
