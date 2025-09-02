"use client";

import { SignOutButton } from "@clerk/nextjs";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerOverlay,
	DrawerPortal,
	DrawerTitle,
	DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";

export default function MobileHeader({ className }: { className?: string }) {
	const pathname = usePathname();
	const user = useQuery(api.users.current);

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
						<DrawerTitle className='flex justify-between px-6 py-4'>
							<DrawerClose asChild>
								<Link href='/' className='w-1/4'>
									<Image
										src={LogoBlue}
										alt='IFI-Navet'
										className='brightness-0 grayscale invert'
										priority
									/>
								</Link>
							</DrawerClose>
							<DrawerClose>
								<X className='size-6 text-primary-foreground' />
							</DrawerClose>
						</DrawerTitle>
						<ScrollArea>
							<ul className='mx-6 flex flex-col items-end'>
								<li>
									<DrawerClose asChild>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/events'>Arrangementer</Link>
										</Button>
									</DrawerClose>
								</li>
								<li>
									<DrawerClose asChild>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/job-listings'>Stillingsannonser</Link>
										</Button>
									</DrawerClose>
								</li>
								<li>
									<DrawerClose asChild>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/events?external=true'>Eksterne arrangementer</Link>
										</Button>
									</DrawerClose>
								</li>
								<li>
									<DrawerClose asChild>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/companies'>For bedrifter</Link>
										</Button>
									</DrawerClose>
								</li>
								<li>
									<DrawerClose asChild>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/students'>For studenter</Link>
										</Button>
									</DrawerClose>
								</li>
								<li>
									<DrawerClose asChild>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/organization'>Om Foreningen</Link>
										</Button>
									</DrawerClose>
								</li>
								<li>
									<DrawerClose asChild>
										<Button
											type='button'
											variant='link'
											className='text-primary-foreground'
											asChild
										>
											<Link href='/contact'>Si Ifra</Link>
										</Button>
									</DrawerClose>
								</li>
							</ul>
							<Separator className='text-primary-foreground/50' />
							<ul className='mx-6 flex flex-col items-end'>
								<AuthLoading>
									<li>
										<DrawerClose asChild>
											<Button
												type='button'
												variant='link'
												className='text-primary-foreground'
												asChild
											>
												<Link href='/profile'>"Profil"</Link>
											</Button>
										</DrawerClose>
									</li>
								</AuthLoading>
								<Authenticated>
									<li>
										<DrawerClose asChild>
											<Button
												type='button'
												variant='link'
												className='text-primary-foreground'
												asChild
											>
												<Link href='/profile'>{user?.firstName ?? "Profil"}</Link>
											</Button>
										</DrawerClose>
									</li>
									<li>
										<DrawerClose asChild>
											<Button
												type='button'
												variant='link'
												className='text-primary-foreground'
												asChild
											>
												<SignOutButton>Logg ut</SignOutButton>
											</Button>
										</DrawerClose>
									</li>
								</Authenticated>
								<Unauthenticated>
									<li>
										<DrawerClose asChild>
											<Button
												type='button'
												variant='link'
												className='text-primary-foreground'
												asChild
											>
												<Link href={`/sign-in?redirect=${pathname}`}>Logg inn</Link>
											</Button>
										</DrawerClose>
									</li>
								</Unauthenticated>
							</ul>
						</ScrollArea>
					</DrawerContent>
				</DrawerPortal>
			</Drawer>
		</header>
	);
}
