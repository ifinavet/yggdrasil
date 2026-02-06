import { currentUser } from "@clerk/nextjs/server";
import ThemeSwitcher from "@workspace/ui/components/theme-switcher";
import Image from "next/image";
import { Suspense } from "react";
import Navet from "@/assets/navet/simple_logo_blaa.webp";

export default async function Header() {
  return (
    <header className="my-2 flex h-20 items-center justify-between px-4 py-6">
      <Image
        src={Navet}
        alt="Navet Logo"
        className="h-full w-auto dark:brightness-0 dark:grayscale dark:invert"
      />
      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <Suspense fallback={null}>
          <User />
        </Suspense>
      </div>
    </header>
  );
}

async function User() {
  const user = await currentUser();

  if (user) {
    return <div>{user.firstName}</div>;
  }
}
