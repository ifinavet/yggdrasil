"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { Button } from "@workspace/ui/components/button";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import NavetLogo from "@/assets/navet/logo_n_blaa.webp";

export default function Header() {
	return (
		<header className='sticky top-0 z-100 w-screen min-w-0 max-w-[1200px] px-4 md:px-6 lg:mx-auto'>
			<div className='my-6 flex h-20 w-full items-center justify-between rounded-xl bg-primary px-8 py-6 shadow-xl dark:bg-gray-800'>
				<Link href='/' className='flex h-full justify-center'>
					<div className='h-full'>
						<Image
							src={NavetLogo}
							alt='Navet'
							className='h-full w-auto brightness-0 grayscale invert'
						/>
					</div>
				</Link>
				<LargeNavigation className='hidden xl:block' />
				<MediumNavigation className='hidden md:block xl:hidden' />
				<DropdownNavigation className='md:hidden' />
			</div>
		</header>
	);
}

function MediumNavigation({ className }: Readonly<{ className?: string }>) {
	return (
		<>
			<div className={className}>
				<NavigationMenu viewport={false}>
					<NavigationMenuList>
						<NavigationMenuItem>
							<NavigationTrigger href='/events'>Arrangementer</NavigationTrigger>
							<NavigationMenuContent className='z-10'>
								<div className='grid w-[300px] gap-4'>
									<NavigationMenuLink asChild>
										<Link href='/events'>
											<div className='font-medium'>Arrangementer</div>
											<div className='text-muted-foreground'>
												Se alle bedriftspresentasjonene og faglige arrangementene for semesteret.
											</div>
										</Link>
									</NavigationMenuLink>
									<NavigationMenuLink asChild>
										<Link href='/events?external=true'>
											<div className='font-medium'>Externe Arrangementer</div>
											<div className='text-muted-foreground'>
												Arrangementer som ikke er i regi av Navet.
											</div>
										</Link>
									</NavigationMenuLink>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>

						<NavigationItem href='/job-listings'>Stillingsannonser</NavigationItem>
					</NavigationMenuList>
				</NavigationMenu>
			</div>
			<div className={className}>
				<DropdownNavigation />
			</div>
		</>
	);
}

function DropdownNavigation({ className }: Readonly<{ className?: string }>) {
	const { user } = useUser();
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild className={className}>
				<Button size='icon' className="text-primary-foreground" variant="link">
					<Menu className='size-6' />
				</Button>
			</PopoverTrigger>
			<PopoverContent className={cn("z-120", className)} align='end'>
				<div className='grid gap-4'>
					<Link href='/events' className='hover:underline' onClick={() => setOpen(false)}>
						Arrangementer
					</Link>
					<Link href='/job-listings' className='hover:underline' onClick={() => setOpen(false)}>
						Stillingsannonser
					</Link>
					<Link
						href='/events?external=true'
						className='hover:underline'
						onClick={() => setOpen(false)}
					>
						Eksterne Arrangementer
					</Link>
					<Link href='/students' className='hover:underline' onClick={() => setOpen(false)}>
						For studenter
					</Link>
					<Link href='/contact' className='hover:underline' onClick={() => setOpen(false)}>
						Si Ifra
					</Link>
					<Link href='/companies' className='hover:underline' onClick={() => setOpen(false)}>
						For bedrifter
					</Link>
					<Link href='/organization' className='hover:underline' onClick={() => setOpen(false)}>
						Om oss
					</Link>
					<Separator />
					<AuthLoading>
						<Link href="/profile">Profil</Link>
					</AuthLoading>
					<Authenticated>
						<Link href='/profile' onClick={() => setOpen(false)}>
							{user?.firstName?.split(" ")[0] ?? "profil"}
						</Link>
						<div className='text-left'>
							<SignOutButton>Logg ut</SignOutButton>
						</div>
					</Authenticated>
					<Unauthenticated>
						<Link href='/sign-in' className='hover:underline' onClick={() => setOpen(false)}>
							Logg inn
						</Link>
					</Unauthenticated>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function LargeNavigation({ className }: Readonly<{ className?: string }>) {
	const { user } = useUser();

	return (
		<>
			<div className={className}>
				<NavigationMenu viewport={false}>
					<NavigationMenuList>
						<NavigationMenuItem>
							<NavigationTrigger href='/events'>Arrangementer</NavigationTrigger>
							<NavigationMenuContent className='z-10'>
								<div className='grid w-[300px] gap-4'>
									<NavigationMenuLink asChild>
										<Link href='/events'>
											<div className='font-medium'>Arrangementer</div>
											<div className='text-muted-foreground'>
												Se alle bedriftspresentasjonene og faglige arrangementene for semesteret.
											</div>
										</Link>
									</NavigationMenuLink>
									<NavigationMenuLink asChild>
										<Link href='/events?external=true'>
											<div className='font-medium'>Externe Arrangementer</div>
											<div className='text-muted-foreground'>
												Arrangementer som ikke er i regi av Navet.
											</div>
										</Link>
									</NavigationMenuLink>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>

						<NavigationItem href='/job-listings'>Stillingsannonser</NavigationItem>

						<NavigationItem href='/companies'>For Bedrifter</NavigationItem>

						<NavigationMenuItem>
							<NavigationTrigger href='/students'>For studenter</NavigationTrigger>
							<NavigationMenuContent className='z-10'>
								<div className='grid w-[300px] gap-4'>
									<NavigationMenuLink asChild>
										<Link href='/contact'>
											<div className='font-medium'>Si Ifra</div>
											<div className='text-muted-foreground'>
												Har det skjedd noe ubehalig på et av våre arrangementer? Si ifra!
											</div>
										</Link>
									</NavigationMenuLink>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>

						<NavigationItem href='/organization'>Om Oss</NavigationItem>
					</NavigationMenuList>
				</NavigationMenu>
			</div>
			<div className={className}>
				<NavigationMenu>
					<NavigationMenuList>
						<AuthLoading>
							<NavigationItem href='profile'>Profil</NavigationItem>
						</AuthLoading>
						<Authenticated>
							<NavigationMenuItem>
								<NavigationTrigger href='/profile'>
									{user?.firstName?.split(" ")[0] ?? "profil"}
								</NavigationTrigger>
								<NavigationMenuContent className='z-10'>
									<div className='grid w-[100px] gap-4'>
										<NavigationMenuLink className='text-left text-base' asChild>
											<Link href='/profile'>Profil</Link>
										</NavigationMenuLink>
										<NavigationMenuLink className='text-left text-base' asChild>
											<SignOutButton>Logg ut</SignOutButton>
										</NavigationMenuLink>
									</div>
								</NavigationMenuContent>
							</NavigationMenuItem>
						</Authenticated>
						<Unauthenticated>
							<NavigationItem href='/sign-in'>Logg inn</NavigationItem>
						</Unauthenticated>
					</NavigationMenuList>
				</NavigationMenu>
			</div>
		</>
	);
}

function NavigationTrigger({
	href,
	children,
}: Readonly<{ href: string; children: React.ReactNode }>) {
	return (
		<NavigationMenuTrigger className='bg-primary text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground focus:underline data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:focus:bg-primary data-[state=open]:focus:text-primary-foreground data-[state=open]:hover:bg-primary data-[state=open]:hover:text-primary-foreground data-[state=open]:hover:underline dark:bg-gray-800 dark:text-primary-foreground data-[state=open]:dark:bg-gray-800 focus:dark:bg-gray-800 hover:dark:bg-gray-800 hover:dark:text-primary-foreground'>
			<Link href={href}>{children}</Link>
		</NavigationMenuTrigger>
	);
}

function NavigationItem({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
	return (
		<NavigationMenuItem>
			<NavigationMenuLink
				asChild
				className="px-4 py-2 text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:underline focus:bg-primary focus:text-primary-foreground focus:underline dark:bg-gray-800 dark:text-primary-foreground focus:dark:bg-gray-800 hover:dark:bg-gray-800"
			>
				<Link href={href}>{children}</Link>
			</NavigationMenuLink>
		</NavigationMenuItem>
	);
}
