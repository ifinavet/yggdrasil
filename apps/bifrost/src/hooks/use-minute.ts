"use client";

import { MINUTE_MS, OSLO_TIME_ZONE } from "@workspace/shared/time";
import { useEffect, useState } from "react";

export function floorToMinute(timestamp: number) {
	return Math.floor(timestamp / MINUTE_MS) * MINUTE_MS;
}

const OSLO_CLOCK = new Intl.DateTimeFormat("en-US", {
	timeZone: OSLO_TIME_ZONE,
	hourCycle: "h23",
	hour: "numeric",
	minute: "numeric",
});

export function startOfOsloDay(timestamp: number) {
	const parts = new Map(
		OSLO_CLOCK.formatToParts(timestamp).map(({ type, value }) => [type, Number(value)]),
	);
	const elapsed = ((parts.get("hour") ?? 0) * 60 + (parts.get("minute") ?? 0)) * MINUTE_MS;
	return floorToMinute(timestamp) - elapsed;
}

export function useMinute() {
	const [minute, setMinute] = useState(() => floorToMinute(Date.now()));
	useEffect(() => {
		const timer = setInterval(() => setMinute(floorToMinute(Date.now())), MINUTE_MS);
		return () => clearInterval(timer);
	}, []);
	return minute;
}
