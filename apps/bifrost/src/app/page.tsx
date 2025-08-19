import { auth } from "@clerk/nextjs/server";
import FavoriteResources from "@/components/home/favorited-resources";
import UpcomingEventsOverview from "@/components/home/upcomming-events-overview";
import { WELCOME_MESSAGES } from "@/constants/welcome-messages";

export default async function Page() {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) return redirectToSignIn();

  return (
    <>
      <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
        {WELCOME_MESSAGES[new Date().getDay()]}
      </h2>
      <div className='grid max-h-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2'>
        <UpcomingEventsOverview className='max-h-full overflow-x-clip overflow-y-scroll' />
        <FavoriteResources />
      </div>
    </>
  );
}
