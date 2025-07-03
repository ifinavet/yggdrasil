import { auth } from "@clerk/nextjs/server";
import { Title } from "@/components/common/title";
import Registrations from "@/components/profile/registrations";
import UpdateProfileForm from "@/components/profile/update-profile-form";
import { getPointsById, getRegistrationsById } from "@/lib/query/profile";

export default async function ProfilePage() {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const points = await getPointsById(userId);

  return (
    <div className='mx-auto max-w-5xl md:w-3/5'>
      <Title>Profil</Title>
      <div className='flex flex-col gap-6'>
        <div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
            Din profil
          </h2>
          <UpdateProfileForm userId={userId} />
        </div>
        <div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
            Prikker
          </h2>
          <UpdateProfileForm userId={userId} />
        </div>
        <div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl tracking-tight first:mt-0'>
            Dine kommende bedriftspresentasjoner
          </h2>
          <Registrations userId={userId} />
        </div>
      </div>
    </div>
  );
}
