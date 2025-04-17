'use client'

import {useEffect} from 'react';
import {useTitle} from "@/app/contexts/TitleContext";

export default function TitleUpdater({title}: { title: string }) {
    const {setTitle} = useTitle();

    useEffect(() => {
        setTitle(title);
    }, [title, setTitle]);

    return null;
}