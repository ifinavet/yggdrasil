"use client";

import { SignInButton } from "@clerk/nextjs";
import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import EditRegistration from "./edit-registration";
import SignUpForm from "./sign-up-form";

export default function RegistrationButton({
  registration,
  eventId,
  availableSpots,
}: {
  registration: FunctionReturnType<typeof api.registration.getByEventId>;
  eventId: Id<"events">;
  availableSpots: number;
}) {
  const currentUser = useQuery(api.users.current);
  const currentUsersPoints = useQuery(api.points.getCurrentStudentsPoints);
  const numberOfPoints = currentUsersPoints?.reduce((acc, curr) => acc + curr.severity, 0) || 0;

  const currentUsersRegistration = registration.registered.find(
    (registration) => registration.userId === currentUser?._id,
  );
  const currentUsersWaitlistRegistration = registration.waitlist.find(
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
        className='!opacity-100 w-fit rounded-xl bg-amber-600 py-8 text-lg hover:cursor-pointer hover:bg-zinc-700'
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

  const registrationToEdit =
    currentUsersRegistration ?? currentUsersWaitlistRegistration;

  if (!registrationToEdit) {
    return null;
  }

  return <EditRegistration registration={registrationToEdit} />;
}
