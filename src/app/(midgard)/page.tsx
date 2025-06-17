"use client";

import { useUser } from "@clerk/nextjs";

export default function Page() {
  const { user } = useUser();

  console.log(user?.imageUrl);
  return (
    <div>
      <h1>Welcome to Midgard!</h1>
      <p>This is the home page of Midgard.</p>
    </div>
  );
}
