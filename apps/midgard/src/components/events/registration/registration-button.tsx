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

  if (!userId) {
    // Should not happen inside <SignedIn>, but handle gracefully
    return null;
  }

  return (
    <>
      <SignedIn>
        {!userRegistration ? (
          <SignUpForm
            event_id={event_id}
            user_id={userId}
            className={`w-1/2 rounded-xl bg-emerald-600 py-8 text-center font-semibold text-lg hover:cursor-pointer hover:bg-emerald-700`}
            waitlist={availableSpots === 0}
          />
        ) : (
          <Unregister user_id={userId} event_id={event_id} />
        )}
      </SignedIn>
      <SignedOut>
        <Button
          type='button'
          className='w-1/2 rounded-xl bg-zinc-800 py-8 text-lg hover:cursor-pointer hover:bg-zinc-700'
          asChild
        >
          <SignInButton>Logg inn</SignInButton>
        </Button>
      </SignedOut>
    </>
  );
}
