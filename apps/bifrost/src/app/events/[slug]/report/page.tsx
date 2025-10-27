import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { fetchQuery } from "convex/nextjs";
import DegreeTables from "@/components/events/report/table";

export default async function RapportPage({
	params,
}: Readonly<{ params: Promise<{ slug: Id<"events"> }> }>) {
	const { slug } = await params;

	const registrantsInfo = await fetchQuery(
		api.registration.getRegistrantsInfo,
		{ eventId: slug },
	);

	return (
		<div>
			<h3 className="border-b pb-2 font-semibold text-3xl tracking-tight">
				Rapport
			</h3>
			<DegreeTables data={registrantsInfo} />
		</div>
	);
}
