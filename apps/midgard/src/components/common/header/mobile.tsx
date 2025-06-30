import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
import { Button } from "@workspace/ui/components/button";
import { DialogClose, DialogTitle } from "@workspace/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";

export default function MobileHeader() {
  const { isLoaded, user } = useUser();

  return (
    <header className='grid place-items-center align-middle justify-center bg-primary mb-6'>
      <Drawer direction='top'>
        <DrawerTrigger asChild>
          <div className='flex items-center justify-between py-6 px-6'>
            <Link href='/' className="w-1/4">
              <Image
                src={LogoBlue}
                alt='IFI-Navet'
                className='grayscale invert brightness-0'
                priority
              />
            </Link>
            <div>
              <Menu className="size-6 text-primary-foreground" />
            </div>
          </div>
        </DrawerTrigger>
        <DrawerPortal>
          <DrawerOverlay />
          <DrawerContent className='bg-primary w-full fixed'>
            <DialogTitle className='flex justify-between py-4 px-6'>
              <Link href='/' className="w-1/4">
                <Image
                  src={LogoBlue}
                  alt='IFI-Navet'
                  className='grayscale invert brightness-0'
                  priority
                />
              </Link>
              <DialogClose>
                <X className="size-6 text-primary-foreground" />
              </DialogClose>
            </DialogTitle>
            <ScrollArea>
              <ul className='flex flex-col items-end mx-6'>
                <li>
                  <Button type='button' variant='link' className='text-primary-foreground' asChild>
                    <Link href='/'>Arrangementer</Link>
                  </Button>
                </li>
                <li>
                  <Button type='button' variant='link' className='text-primary-foreground' asChild>
                    <Link href='/'>Stillingsannonser</Link>
                  </Button>
                </li>
                <li>
                  <Button type='button' variant='link' className='text-primary-foreground' asChild>
                    <Link href='/'>Eksterne arrangementer</Link>
                  </Button>
                </li>
                <li>
                  <Button type='button' variant='link' className='text-primary-foreground' asChild>
                    <Link href='/'>For bedrifter</Link>
                  </Button>
                </li>
                <li>
                  <Button type='button' variant='link' className='text-primary-foreground' asChild>
                    <Link href='/'>For studenter</Link>
                  </Button>
                </li>
                <li>
                  <Button type='button' variant='link' className='text-primary-foreground' asChild>
                    <Link href='/'>Si ifra</Link>
                  </Button>
                </li>
              </ul>
              <Separator className="text-primary-foreground/50" />
              <ul className="flex flex-col items-end mx-6">
                <SignedIn>
                  <li>
                    <Button type='button' variant='link' className='text-primary-foreground' asChild>
                      <Link href='/'>{isLoaded ? user?.fullName : "Laster..."}</Link>
                    </Button>
                  </li>
                  <li>
                    <Button type='button' variant='link' className='text-primary-foreground' asChild>
                      <SignOutButton>Logg ut</SignOutButton>
                    </Button>
                  </li>
                </SignedIn>
                <SignedOut>
                  <li>
                    <Button type='button' variant='link' className='text-primary-foreground' asChild>
                      <SignInButton>Logg inn</SignInButton>
                    </Button>
                  </li>
                </SignedOut>
              </ul>
            </ScrollArea>
          </DrawerContent>
        </DrawerPortal>
      </Drawer>
    </header>
  );
}
