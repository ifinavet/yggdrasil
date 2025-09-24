import { auth } from "@clerk/nextjs/server";
import { api } from "@workspace/backend/convex/api";
import { preloadQuery } from "convex/nextjs";
import FavoriteResources from "@/components/home/favorited-resources";
import UpcomingEventsOverview from "@/components/home/upcomming-events-overview";
import { WELCOME_MESSAGES } from "@/constants/welcome-messages";

export default async function Page() {
	const { userId, redirectToSignIn } = await auth();

	if (!userId) return redirectToSignIn();

	const preloadedEvents = await preloadQuery(api.events.getLatest, { n: 7 });

	return (
		<div className="flex max-h-full flex-col gap-4 overflow-clip">
			<h3 className="border-b pb-2 font-semibold text-3xl tracking-tight">
				{WELCOME_MESSAGES[new Date().getDay()]}
			</h3>

			<div className="grid max-h-full max-w-[1500px] grid-cols-1 gap-6 overflow-clip lg:grid-cols-2 xl:grid-cols-3">
				<div>
					<h3 className="mb-2 scroll-m-20 font-semibold text-2xl tracking-tight">
						Kommende arrangementer
					</h3>
					<UpcomingEventsOverview preloadedEvents={preloadedEvents} />
				</div>

				<div>
					<h3 className="mb-2 scroll-m-20 font-semibold text-2xl tracking-tight">
						Nyttige ressurser
					</h3>
					<FavoriteResources />
				</div>
			</div>
		</div>
	);
}
