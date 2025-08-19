import { api } from "@workspace/backend/convex/api";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { fetchQuery } from "convex/nextjs";
import ResourceCard from "../resources/resource-card";


export default async function FavoriteResources({ className }: Readonly<{ className?: string }>) {
	const resources = await fetchQuery(api.resources.getFavorites);

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			<h3 className='scroll-m-20 font-semibold text-2xl tracking-tight'>Nyttige ressurser</h3>
			<div className='space-y-2'>
				<ScrollArea>
					{resources.map((resource) => (
						<ResourceCard key={resource._id} resource={resource} />
					))}
				</ScrollArea>
			</div>
		</div>
	);
}
