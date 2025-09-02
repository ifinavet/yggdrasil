"use client";

import { SignOutButton } from "@clerk/nextjs";
import { api } from "@workspace/backend/convex/api";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";
import { cn } from "@workspace/ui/lib/utils";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoBlue from "@/assets/navet/simple_logo_blaa.webp";

export default function DesktopHeader({ className }: { className?: string }) {
	const pathname = usePathname();
	const user = useQuery(api.users.current);

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
				<NavigationMenuList className='flex-wrap'>
					<NavigationMenuItem>
						<NavigationMenuTrigger className='bg-primary text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground focus:underline data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:focus:bg-primary data-[state=open]:focus:text-primary-foreground data-[state=open]:hover:bg-primary data-[state=open]:hover:text-primary-foreground data-[state=open]:hover:underline'>
							<Link href='/events'>Arrangementer</Link>
						</NavigationMenuTrigger>
						<NavigationMenuContent className='z-10'>
							<div className='grid w-[300px] gap-4'>
								<NavigationMenuLink className='text-base' asChild>
									<Link href='/events '>Arrangementer</Link>
								</NavigationMenuLink>
								<NavigationMenuLink className='text-base' asChild>
									<Link href='/events?external=true'>Eksterne Arrangementer</Link>
								</NavigationMenuLink>
							</div>
						</NavigationMenuContent>
					</NavigationMenuItem>
					<NavigationItem href='/job-listings'>Stillingsannonser</NavigationItem>
					<NavigationItem href='/companies'>For Bedrifter</NavigationItem>
					<NavigationItem href='/students'>For Studenter</NavigationItem>
					<NavigationItem href='/organization'>Om Foreningen</NavigationItem>
					<NavigationItem href='/contact'>Si Ifra</NavigationItem>
					<AuthLoading>
						<NavigationItem href='/profile'>Profil</NavigationItem>
					</AuthLoading>
					<Authenticated>
						<NavigationMenuItem>
							<NavigationMenuTrigger className='bg-primary text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground focus:underline data-[state=open]:bg-primary data-[state=open]:text-primary-foreground data-[state=open]:focus:bg-primary data-[state=open]:focus:text-primary-foreground data-[state=open]:hover:bg-primary data-[state=open]:hover:text-primary-foreground data-[state=open]:hover:underline'>
								<Link href='/profile'>{user?.firstName || "User"}</Link>
							</NavigationMenuTrigger>
							<NavigationMenuContent className='z-10'>
								<div className='grid w-[200px] gap-4'>
									<NavigationMenuLink className='w-full text-left text-base' asChild>
										<Link href={"/profile"}>Profil</Link>
									</NavigationMenuLink>
									<NavigationMenuLink
										asChild
										className='w-full text-left text-base hover:cursor-pointer'
									>
										<SignOutButton>Logg ut</SignOutButton>
									</NavigationMenuLink>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>
					</Authenticated>
					<Unauthenticated>
						<NavigationMenuItem>
							<NavigationMenuLink
								asChild
								className='px-4 py-2 text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:underline focus:bg-primary focus:text-primary-foreground focus:underline'
							>
								<Link href={`/sign-in?redirect=${pathname}`}>Logg inn</Link>
							</NavigationMenuLink>
						</NavigationMenuItem>
					</Unauthenticated>
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
				className='px-4 py-2 text-base text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:underline focus:bg-primary focus:text-primary-foreground focus:underline'
			>
				<Link href={href}>{children}</Link>
			</NavigationMenuLink>
		</NavigationMenuItem>
	);
}
