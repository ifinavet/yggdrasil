import { auth } from "@clerk/nextjs/server";
import { Title } from "@/components/common/title";
import Points from "@/components/profile/points";
import Registrations from "@/components/profile/registrations";
import UpdateProfileForm from "@/components/profile/update-profile-form";

export default async function ProfilePage() {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  return (
    <div className="mx-auto max-w-5xl px-8 md:w-6/7 xl:w-3/5">
      <Title>Profil</Title>
      <div className='grid gap-6 md:grid-cols-2'>
        <div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
            Din profil
          </h2>
          <UpdateProfileForm userId={userId} />
        </div>
        <div className='row-span-2'>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
            Dine prikker
          </h2>
          <Points userId={userId} />
        </div>
        <div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
            Dine kommende bedriftspresentasjoner
          </h2>
          <Registrations userId={userId} />
        </div>
      </div>
    </div>
  );
}
