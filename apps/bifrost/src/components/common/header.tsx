"use client";

import { SidebarTrigger } from "@workspace/ui/components//sidebar";
import { Separator } from "@workspace/ui/components/separator";
import ThemeSwitcher from "@workspace/ui/components/theme-switcher";

export default function Header() {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<ThemeSwitcher />
				<Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
				<h1 className="font-medium text-base">Bifrost</h1>
			</div>
		</header>
	);
}
