import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import ThemeSwitcher from "@workspace/ui/components/theme-switcher";
import Image from "next/image";
import { Suspense } from "react";
import N from "@/assets/navet/logo_n_blaa.webp";
import Navet from "@/assets/navet/simple_logo_blaa.webp";

export default async function Header() {
	return (
		<header className="my-2 flex h-20 items-center justify-between px-4 py-6">
			<Image
				src={Navet}
				alt="Navet Logo"
				className="hidden h-full w-auto md:inline-block dark:brightness-0 dark:grayscale dark:invert"
			/>
			<Image
				src={N}
				alt="Navet Logo"
				className="h-full w-auto md:hidden dark:brightness-0 dark:grayscale dark:invert"
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
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost">{user.firstName}</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuGroup>
						<SignOutButton>
							<DropdownMenuItem className="w-full">Logg ut</DropdownMenuItem>
						</SignOutButton>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}
}
