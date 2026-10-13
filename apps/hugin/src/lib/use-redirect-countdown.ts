import { useEffect, useState } from "react";

export function useRedirectCountdown(seconds: number, paused: boolean, onDone: () => void) {
	const [remaining, setRemaining] = useState(seconds);

	useEffect(() => {
		if (paused) return;
		if (remaining <= 0) {
			onDone();
			return;
		}
		const timer = setTimeout(() => setRemaining(remaining - 1), 1000);
		return () => clearTimeout(timer);
	}, [paused, remaining, onDone]);

	return remaining;
}
