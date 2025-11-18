"use client";

import { api } from "@workspace/backend/convex/api";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";
import { useQuery } from "convex/react";
import ResourceCard from "./resource-card";

export default function ResourcesGrid() {
	const resources = useQuery(api.resources.getAllGroupedByTag);
	const hasEditRights = useQuery(api.accsessRights.checkRights, {
		right: ["admin", "super-admin", "editor"],
	});

	if (!resources) return <Spinner className="size-8" />;

	return (
		<div className="mx-4 flex flex-col gap-4">
			{Object.entries(resources.groupedByTag).map(([tag, resources]) => (
				<div key={tag} className="flex flex-col gap-4">
					<h4 className="scroll-m-20 font-semibold text-xl capitalize tracking-tight">
						{tag}
					</h4>
					<div className="grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{resources.map((resource) => (
							<ResourceCard key={resource._id} resource={resource} />
						))}
					</div>
				</div>
			))}

			{resources?.unpublishedResources.length > 0 && hasEditRights && (
				<div className="flex flex-col gap-4">
					<h4 className="scroll-m-20 font-semibold text-xl tracking-tight">
						Upubliserte ressurser
					</h4>
					<Separator />
					<div className="grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{resources.unpublishedResources.map((resource) => (
							<ResourceCard key={resource._id} resource={resource} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
