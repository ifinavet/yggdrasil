import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@workspace/ui/components/button";
import type { Tables } from "@/lib/supabase/database.types";
import SignUpForm from "./sign-up-form";
import Unregister from "./unregister";

export default async function RegistrationButton({
  userRegistration,
  event_id,
  availableSpots,
}: {
  userRegistration?: Tables<"registrations">;
  event_id: number;
  availableSpots: number;
}) {
  const { userId } = await auth();

  return (
    <>
      <SignedIn>
        {!userRegistration ? (
          <SignUpForm
            event_id={event_id}
            user_id={userId!}
            buttonClassName={`rounded-xl bg-emerald-600 text-center py-8 w-1/2 text-lg font-semibold hover:bg-emerald-700 hover:cursor-pointer`}
            waitlist={availableSpots === 0}
          />
        ) : (
          <Unregister user_id={userId!} event_id={event_id} />
        )}
      </SignedIn>
      <SignedOut>
        <Button
          type='button'
          className='rounded-xl bg-zinc-800 hover:bg-zinc-700 hover:cursor-pointer py-8 text-lg w-1/2'
          asChild
        >
          <SignInButton>Logg inn</SignInButton>
        </Button>
      </SignedOut>
    </>
  );
}
