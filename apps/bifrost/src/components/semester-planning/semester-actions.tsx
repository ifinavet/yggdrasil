"use client";

import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

/** The element at the right of the semester toolbar, where the open tab puts its buttons. */
export const SemesterActionsSlot = createContext<HTMLElement | null>(null);

/** Renders a tab's own buttons or filters, e.g. «Ferdigstill plan», in the toolbar next to the tabs. */
export function SemesterActions({ children }: Readonly<{ children: ReactNode }>) {
	const slot = useContext(SemesterActionsSlot);
	return slot ? createPortal(children, slot) : null;
}
