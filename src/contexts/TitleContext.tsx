"use client";

import { ReactNode, createContext, useContext, useState } from "react";

interface TitleContextType {
    title: string;
    setTitle: (title: string) => void;
}

const TitleContext = createContext<TitleContextType | undefined>(undefined);

export function TitleProvider({ children }: { children: ReactNode }) {
    const [title, setTitle] = useState("bifrost");

    return <TitleContext.Provider value={{ title, setTitle }}>{children}</TitleContext.Provider>;
}

export function useTitle() {
    const context = useContext(TitleContext);
    if (context === undefined) {
        throw new Error("useTitle must be used within a TitleProvider");
    }
    return context;
}
