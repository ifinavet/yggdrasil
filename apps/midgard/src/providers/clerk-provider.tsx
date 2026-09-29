"use client";

import { nbNO } from "@clerk/localizations/nb-NO";
import AuthProvider from "@workspace/auth/provider";
import type { ReactNode } from "react";

export default function ClerkProvider({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<AuthProvider localization={nbNO}>
			{children}
		</AuthProvider>
	);
}
