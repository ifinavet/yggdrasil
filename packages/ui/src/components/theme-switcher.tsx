"use client";

import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Laptop, Moon, Sun, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Icon = {
	'light': Sun,
	'dark': Moon,
	'system': Laptop
}

export default function ThemeSwitcher() {
	const [mounted, setMounted] = useState(false);
	const { theme = "system", setTheme } = useTheme();

	// useEffect only runs on the client, so now we can safely show the UI
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	const ICON_SIZE = 16;
	const CurrentIcon = Icon[theme as keyof typeof Icon] ?? TriangleAlert;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='ghost' size={"sm"}>
					<CurrentIcon size={ICON_SIZE} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className='w-content' align='start'>
				<DropdownMenuRadioGroup value={theme} onValueChange={(e) => setTheme(e)}>
					<DropdownMenuRadioItem className='flex gap-2' value='light'>
						<Sun size={ICON_SIZE} className='text-muted-foreground' /> <span>Light</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem className='flex gap-2' value='dark'>
						<Moon size={ICON_SIZE} className='text-muted-foreground' /> <span>Dark</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem className='flex gap-2' value='system'>
						<Laptop size={ICON_SIZE} className='text-muted-foreground' /> <span>System</span>
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
