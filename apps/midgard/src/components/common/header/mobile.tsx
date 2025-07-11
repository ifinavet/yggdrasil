import { SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
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
import { cn } from "@workspace/ui/lib/utils";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";

export default async function MobileHeader({ className }: { className?: string }) {
	const user = await currentUser();

	return (
		<header
			className={cn(
				"mb-6 grid place-items-center justify-center bg-primary align-middle",
				className,
			)}
		>
			<Drawer direction='top'>
				<DrawerTrigger asChild>
					<div className='flex items-center justify-between px-6 py-6'>
						<Link href='/' className='w-1/4'>
							<Image
								src={LogoBlue}
								alt='IFI-Navet'
								className='brightness-0 grayscale invert'
								priority
							/>
						</Link>
						<div>
							<Menu className='size-6 text-primary-foreground' />
						</div>
					</div>
				</DrawerTrigger>
				<DrawerPortal>
					<DrawerOverlay />
					<DrawerContent className='fixed w-full bg-primary'>
						<DialogTitle className='flex justify-between px-6 py-4'>
							<Link href='/' className='w-1/4'>
								<Image
									src={LogoBlue}
									alt='IFI-Navet'
									className='brightness-0 grayscale invert'
									priority
								/>
							</Link>
							<DialogClose>
								<X className='size-6 text-primary-foreground' />
							</DialogClose>
						</DialogTitle>
						<ScrollArea>
							<ul className='mx-6 flex flex-col items-end'>
								<li>
									<Button type='button' variant='link' className='text-primary-foreground' asChild>
										<Link href='/events'>Arrangementer</Link>
									</Button>
								</li>
								<li>
									<Button type='button' variant='link' className='text-primary-foreground' asChild>
										<Link href='/job-listings'>Stillingsannonser</Link>
									</Button>
								</li>
								<li>
									<Button type='button' variant='link' className='text-primary-foreground' asChild>
										<Link href='/events?external=true'>Eksterne arrangementer</Link>
									</Button>
								</li>
								<li>
									<Button type='button' variant='link' className='text-primary-foreground' asChild>
										<Link href='/companies'>For bedrifter</Link>
									</Button>
								</li>
								<li>
									<Button type='button' variant='link' className='text-primary-foreground' asChild>
										<Link href='/students'>For studenter</Link>
									</Button>
								</li>
								<li>
									<Button type='button' variant='link' className='text-primary-foreground' asChild>
										<Link href='/contact'>Si ifra</Link>
									</Button>
								</li>
							</ul>
							<Separator className='text-primary-foreground/50' />
							<ul className='mx-6 flex flex-col items-end'>
								<SignedIn>
									<li>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/profile'>{user?.fullName || "Pofil"}</Link>
										</Button>
									</li>
									<li>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<SignOutButton>Logg ut</SignOutButton>
										</Button>
									</li>
								</SignedIn>
								<SignedOut>
									<li>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
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
