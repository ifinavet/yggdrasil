import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import NavetLogo from "../assets/navet/logo_n_blaa.webp";

export default function Header({
	navigation,
	homeHref = "/",
	sticky = true,
}: Readonly<{ navigation?: ReactNode; homeHref?: string; sticky?: boolean }>) {
	return (
		<header
			className={cn(
				"w-screen min-w-0 max-w-[1200px] px-4 md:px-6 lg:mx-auto",
				sticky && "sticky top-0 z-40",
			)}
		>
			<div className="my-6 flex h-20 w-full items-center justify-between rounded-xl bg-primary px-8 py-6 shadow-xl dark:bg-gray-800">
				<Link href={homeHref} className="flex h-full justify-center">
					<div className="h-full">
						<Image
							src={NavetLogo}
							alt="Navet"
							className="h-full w-auto brightness-0 grayscale invert"
						/>
					</div>
				</Link>
				{navigation}
			</div>
		</header>
	);
}