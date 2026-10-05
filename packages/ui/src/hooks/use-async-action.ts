"use client";

import { convexErrorMessage } from "@workspace/shared/utils";
import { useCallback, useRef, useState } from "react";

export function useAsyncAction(onError?: (message: string) => void, allowConcurrent = false) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const running = useRef(false);
	const run = useCallback(
		async <T>(
			action: () => Promise<T>,
			onSuccess?: (result: T) => void,
			fallback?: string,
		): Promise<boolean> => {
			if (running.current && !allowConcurrent) return false;
			running.current = true;
			setPending(true);
			setError("");
			try {
				const result = await action();
				onSuccess?.(result);
				return true;
			} catch (cause) {
				const message = convexErrorMessage(cause, fallback);
				setError(message);
				onError?.(message);
				return false;
			} finally {
				running.current = false;
				setPending(false);
			}
		},
		[onError, allowConcurrent],
	);
	return { pending, error, run };
}
