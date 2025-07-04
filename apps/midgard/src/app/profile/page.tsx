import { auth, currentUser } from "@clerk/nextjs/server";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import Points from "@/components/profile/points";
import Registrations from "@/components/profile/registrations";
import UpdateProfileForm from "@/components/profile/update-profile-form";
import { getStudentById } from "@/lib/query/profile";

export default async function ProfilePage() {
  const { userId, redirectToSignIn } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return redirectToSignIn();
  }

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["student", userId],
    queryFn: () => getStudentById(userId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ResponsiveCenterContainer>
        <Title>Din Profil</Title>
        <div className='grid max-w-full gap-6 align-top lg:grid-cols-2'>
          <div>
            <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
              Din profil
            </h2>
            <UpdateProfileForm userId={userId} className='mt-4' />
          </div>
          <div className='row-span-2'>
            <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
              Dine prikker
            </h2>
            <Points userId={userId} className='mt-4' />
          </div>
          <div>
            <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
              Dine kommende bedriftspresentasjoner
            </h2>
            <Registrations userId={userId} className='mt-4' />
          </div>
        </div>
      </ResponsiveCenterContainer>
    </HydrationBoundary>
  );
}
