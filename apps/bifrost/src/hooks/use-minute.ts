"use client";

import { MINUTE_MS } from "@workspace/shared/time";
import { useEffect, useState } from "react";

export function floorToMinute(timestamp: number) {
	return Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
}

export function useMinute() {
	const [minute, setMinute] = useState(() => floorToMinute(Date.now()));
	useEffect(() => {
		const timer = setInterval(() => setMinute(floorToMinute(Date.now())), MINUTE_MS);
		return () => clearInterval(timer);
	}, []);
	return minute;
}
