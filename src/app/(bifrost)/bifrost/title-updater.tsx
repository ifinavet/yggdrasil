"use client";

import {useTitle} from "@/contexts/TitleContext";
import {useEffect} from "react";

export default function TitleUpdater({ title }: { title: string }) {
    const { setTitle } = useTitle();

    useEffect(() => {
        setTitle(title);
    }, [title, setTitle]);

    return null;
}
