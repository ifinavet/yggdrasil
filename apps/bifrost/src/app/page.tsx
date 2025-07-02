import { auth } from "@clerk/nextjs/server";
import UpcomingEventsOverview from "@/components/home/upcomming-events-overview";
import { WELCOME_MESSAGES } from "@/constants/welcome-messages";

export default async function Page() {
	const { userId, redirectToSignIn } = await auth();

	if (!userId) return redirectToSignIn();

	return (
		<>
			<h2 className='scroll-m-20 border-b pb-2 font-semibold text-2xl tracking-tight first:mt-0'>
				{WELCOME_MESSAGES[new Date().getDay()]}
			</h2>
			<div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
				<UpcomingEventsOverview />
			</div>
		</>
	);
}
