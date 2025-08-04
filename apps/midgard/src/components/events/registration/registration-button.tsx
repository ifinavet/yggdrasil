"use client";

import { SignInButton } from "@clerk/nextjs";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import SignUpForm from "./sign-up-form";
import Unregister from "./unregister";

export default function RegistrationButton({
  registrations,
  eventId,
  availableSpots,
}: {
  registrations: FunctionReturnType<typeof api.registration.getByEventId>;
  eventId: Id<"events">;
  availableSpots: number;
}) {
  const currentUser = useQuery(api.users.current);
  const currentUsersPoints = useQuery(api.points.getCurrentStudentsPoints);
  const numberOfPoints = currentUsersPoints?.reduce((acc, curr) => acc + curr.severity, 0) || 0;

  const currentUsersRegistration = registrations.registered.find(
    (registration) => registration.userId === currentUser?._id,
  );
  const currentUsersWaitlistRegistration = registrations.waitlist.find(
    (registration) => registration.userId === currentUser?._id,
  );

  if (!currentUser) {
    return (
      <Button
        type='button'
        className='w-1/2 rounded-xl bg-zinc-800 py-8 text-lg hover:cursor-pointer hover:bg-zinc-700'
        asChild
      >
        <SignInButton>Logg inn</SignInButton>
      </Button>
    );
  }

  if (numberOfPoints >= 3) {
    return (
      <Button
        type='button'
        className="!opacity-100 w-fit rounded-xl bg-amber-600 py-8 text-lg hover:cursor-pointer hover:bg-zinc-700"
        disabled
      >
        For mange prikker til å kunne melde deg på.
      </Button>
    );
  }

  if (!currentUsersRegistration && !currentUsersWaitlistRegistration) {
    return (
      <SignUpForm
        eventId={eventId}
        userId={currentUser._id}
        className={`w-1/2 rounded-xl bg-emerald-600 py-8 text-center font-semibold text-lg hover:cursor-pointer hover:bg-emerald-700`}
        waitlist={availableSpots === 0}
      />
    );
  }

  const registrationId = currentUsersRegistration?._id || currentUsersWaitlistRegistration?._id;

  if (!registrationId) {
    // This should never happen, but handle just in case
    return null;
  }

  return <Unregister registrationId={registrationId} />;
}
