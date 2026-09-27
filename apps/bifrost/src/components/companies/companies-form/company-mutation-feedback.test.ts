import type { useRouter } from "next/navigation";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { notifyCompanyMutation } from "./company-mutation-feedback";

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function fakeRouter() {
	return { push: vi.fn() } as unknown as ReturnType<typeof useRouter>;
}

describe("notifyCompanyMutation", () => {
	it("shows a success toast and navigates to the companies list when the mutation resolves", async () => {
		const router = fakeRouter();

		await notifyCompanyMutation(
			Promise.resolve(),
			"Bedriften ble lagt til!",
			"Bedrift opprettet",
			router,
		);

		expect(toast.success).toHaveBeenCalledWith(
			"Bedriften ble lagt til!",
			expect.objectContaining({ description: expect.stringContaining("Bedrift opprettet") }),
		);
		expect(router.push).toHaveBeenCalledWith("/companies");
	});

	it("shows an error toast and does not navigate when the mutation rejects", async () => {
		const router = fakeRouter();

		await notifyCompanyMutation(
			Promise.reject(new Error("noe gikk galt")),
			"Bedriften ble lagt til!",
			"Bedrift opprettet",
			router,
		);

		expect(toast.error).toHaveBeenCalledWith("Noe gikk galt!", { description: "noe gikk galt" });
		expect(router.push).not.toHaveBeenCalled();
	});
});
