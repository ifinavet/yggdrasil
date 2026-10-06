import { useAsyncAction } from "@workspace/ui/hooks/use-async-action";
import { ConvexError } from "convex/values";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

function runner(allowConcurrent = false) {
	const onError = vi.fn();
	let run!: ReturnType<typeof useAsyncAction>["run"];
	function Harness() {
		run = useAsyncAction(onError, allowConcurrent).run;
		return null;
	}
	renderToString(<Harness />);
	return { run, onError };
}

describe("async actions", () => {
	it.each([false, true])(
		"preserves concurrent-action policy (%s) and unlocks after failure",
		async (concurrent) => {
			const { run, onError } = runner(concurrent);
			let reject!: (error: unknown) => void;
			const inFlight = run(
				() =>
					new Promise<void>((_, fail) => {
						reject = fail;
					}),
			);
			const second = vi.fn(async () => 42);
			const succeeded = vi.fn();
			expect(await run(second, succeeded)).toBe(concurrent);
			expect(second).toHaveBeenCalledTimes(concurrent ? 1 : 0);
			if (concurrent) expect(succeeded).toHaveBeenCalledWith(42);
			reject(new ConvexError("Søknaden er endret."));
			expect(await inFlight).toBe(false);
			expect(onError).toHaveBeenLastCalledWith("Søknaden er endret.");
			expect(await run(async () => 7, succeeded)).toBe(true);
			expect(succeeded).toHaveBeenLastCalledWith(7);
			expect(
				await run(
					async () => {
						throw new Error("private provider details");
					},
					undefined,
					"Kunne ikke lagre.",
				),
			).toBe(false);
			expect(onError).toHaveBeenLastCalledWith("Kunne ikke lagre.");
		},
	);
});
