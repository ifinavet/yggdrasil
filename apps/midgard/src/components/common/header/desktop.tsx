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
        "mb-6 place-items-center justify-center bg-primary pb-6 align-middle",
        className,
      )}
    >
      <Link href='/' className='block w-1/10 pt-8 pb-6'>
        <Image src={LogoBlue} alt='IFI-Navet' className='brightness-0 grayscale invert' priority />
      </Link>
      <NavigationMenu viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className='bg-primary text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground focus:underline data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:focus:bg-primary data-[state=open]:focus:text-primary-foreground data-[state=open]:hover:bg-primary data-[state=open]:hover:text-primary-foreground data-[state=open]:hover:underline'>
              <Link href='/events'>Arrangementer</Link>
            </NavigationMenuTrigger>
            <NavigationMenuContent className='z-10'>
              <ul className='grid w-[300px] gap-4'>
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
          <NavigationItem>
            <Link href='/job-listings'>Stillingsannonser</Link>
          </NavigationItem>
          <NavigationItem>
            <Link href='/companies'>For Bedifter</Link>
          </NavigationItem>
          <NavigationItem>
            <Link href='/students'>For Studenter</Link>
          </NavigationItem>
          <NavigationItem>
            <Link href='/contact'>Si ifra</Link>
          </NavigationItem>
          <SignedOut>
            <NavigationItem>
              <SignInButton>Logg inn</SignInButton>
            </NavigationItem>
          </SignedOut>
          <NavigationMenuItem>
            <SignedIn>
              <NavigationMenuTrigger className='bg-primary text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground focus:underline data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:focus:bg-primary data-[state=open]:focus:text-primary-foreground data-[state=open]:hover:bg-primary data-[state=open]:hover:text-primary-foreground data-[state=open]:hover:underline'>
                <Link href='/profile'>{user?.fullName || "User"}</Link>
              </NavigationMenuTrigger>
              <NavigationMenuContent className='z-10'>
                <ul className='grid w-[200px] gap-4'>
                  <li>
                    <NavigationMenuLink asChild className='w-full text-base'>
                      <Link href='/profile'>Profil</Link>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink asChild className='w-full text-left text-base'>
                      <SignOutButton>Logg ut</SignOutButton>
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </SignedIn>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}

function NavigationItem({ children }: { children: React.ReactNode }) {
  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        asChild
        className='px-4 py-2 text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:underline focus:bg-primary focus:text-primary-foreground focus:underline'
      >
        {children}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}
