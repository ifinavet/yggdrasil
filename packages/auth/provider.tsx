import { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";
import { isLocalDevelopment } from "./local";

export default function AuthProvider(props: ComponentProps<typeof ClerkProvider>) {
	return isLocalDevelopment ? props.children : <ClerkProvider {...props} />;
}
