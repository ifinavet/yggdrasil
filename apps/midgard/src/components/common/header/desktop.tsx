import { SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";
import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";

export default async function DesktopHeader({ className }: { className?: string }) {
  const user = await currentUser();

  return (
    <header
      className={cn(
        "place-items-center align-middle justify-center bg-primary pb-6 mb-6",
        className,
      )}
    >
      <Link href='/' className='block w-1/10 pt-8 pb-6'>
        <Image src={LogoBlue} alt='IFI-Navet' className='grayscale invert brightness-0' priority />
      </Link>
      <NavigationMenu viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className='bg-primary hover:bg-primary hover:text-primary-foreground text-primary-foreground text-base data-[state=open]:hover:bg-primary data-[state=open]:hover:underline data-[state=open]:hover:text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground'>
              <Link href='/events'>Arrangementer</Link>
            </NavigationMenuTrigger>
            <NavigationMenuContent className='z-10'>
              <ul className='grid gap-4 w-[300px]'>
                <li>
                  <NavigationMenuLink asChild className='text-base'>
                    <Link href='/events'>Arrangementer</Link>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink asChild className='text-base'>
                    <Link href='/events?external=true'>Eksterne Arrangementer</Link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationItem href='/job-listings'>Stillingsannonser</NavigationItem>
          <NavigationItem href='/companies'>For Bedifter</NavigationItem>
          <NavigationItem href='/students'>For Studenter</NavigationItem>
          <NavigationItem href='/si-ifra'>Si ifra</NavigationItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger className='bg-primary hover:bg-primary hover:text-primary-foreground text-primary-foreground text-base data-[state=open]:hover:bg-primary data-[state=open]:hover:underline data-[state=open]:hover:text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground'>
              <SignedIn>
                <Link href='/profile'>{user?.fullName || "User"}</Link>
              </SignedIn>
              <SignedOut>
                <SignInButton>Logg inn</SignInButton>
              </SignedOut>
            </NavigationMenuTrigger>
            <NavigationMenuContent className='z-10'>
              <ul className='grid gap-4 w-[200px]'>
                <li>
                  <NavigationMenuLink asChild className='text-base w-full'>
                    <Link href='/profile'>Profil</Link>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink asChild className='text-base w-full text-left'>
                    <SignOutButton>Logg ut</SignOutButton>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}

function NavigationItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        asChild
        className='px-4 py-2 text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:underline'
      >
        <Link href={href}>{children}</Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}
