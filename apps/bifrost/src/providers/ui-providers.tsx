"use client";

import { SidebarProvider } from "@workspace/ui/components/sidebar";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

interface UIProvidersProps {
	children: ReactNode;
	sidebar: ReactNode;
}

export default function UIProviders({ children, sidebar }: UIProvidersProps) {
	return (
		<SidebarProvider>
			<ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
				{sidebar}
				{children}
			</ThemeProvider>
		</SidebarProvider>
	);
}
