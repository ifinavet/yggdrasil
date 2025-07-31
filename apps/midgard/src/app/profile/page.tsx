import { auth, } from "@clerk/nextjs/server";
import { api } from "@workspace/backend/convex/api";
import { preloadQuery } from "convex/nextjs";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { Title } from "@/components/common/title";
import Points from "@/components/profile/points";
import Registrations from "@/components/profile/registrations";
import UpdateProfileForm from "@/components/profile/update-profile-form";
import { getAuthToken } from "@/uitls/authToken";

export const metadata = {
  title: "Profil",
};

export default async function ProfilePage() {
  const { userId, redirectToSignIn } = await auth();
  const token = await getAuthToken()

  if (!userId) return redirectToSignIn();

  const preloadedStudent = await preloadQuery(api.students.getCurrent, {}, { token });

  return (
    <ResponsiveCenterContainer>
      <Title>Din Profil</Title>
      <div className='grid max-w-full gap-6 align-top lg:grid-cols-2'>
        <div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
            Din profil
          </h2>
          <UpdateProfileForm preloadedStudent={preloadedStudent} className='mt-4' />
        </div>
        <div className='row-span-2'>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
            Dine prikker
          </h2>
          <Points className='mt-4' />
        </div>
        <div>
          <h2 className='scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0'>
            Dine kommende bedriftspresentasjoner
          </h2>
          <Registrations className='mt-4' />
        </div>
      </div>
    </ResponsiveCenterContainer>
  );
}
