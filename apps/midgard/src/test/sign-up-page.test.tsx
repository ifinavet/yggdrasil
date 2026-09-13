import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "@workspace/backend/convex/api";
import { DEGREE_TYPES, STUDY_PROGRAMS } from "@workspace/shared/constants";
import { type FunctionReference, getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CREATED_USER_ID = "clerk_new_user";

const clerkState = { isSignedIn: false };
const signUpState = { verificationStatus: "complete" };
const convexAuthState = { isAuthenticated: false };

const mutationReferences: unknown[] = [];
const createStudent = vi.fn();
const routerPush = vi.fn();
const postHogCapture = vi.fn();
const setActive = vi.fn();

vi.mock("@clerk/nextjs", () => ({
	useAuth: () => ({ isSignedIn: clerkState.isSignedIn }),
}));

vi.mock("@clerk/nextjs/errors", () => ({
	isClerkAPIResponseError: () => false,
}));

vi.mock("@clerk/nextjs/legacy", () => ({
	useSignUp: () => ({
		isLoaded: true,
		setActive,
		signUp: {
			create: vi.fn().mockResolvedValue(undefined),
			prepareEmailAddressVerification: vi.fn().mockResolvedValue(undefined),
			attemptEmailAddressVerification: vi.fn().mockResolvedValue({
				status: signUpState.verificationStatus,
				createdSessionId: "sess_1",
				createdUserId: CREATED_USER_ID,
			}),
		},
	}),
}));

vi.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: convexAuthState.isAuthenticated }),
	useMutation: (reference: unknown) => {
		mutationReferences.push(reference);
		return createStudent;
	},
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: routerPush }),
}));

vi.mock("posthog-js/react", () => ({
	usePostHog: () => ({ capture: postHogCapture }),
}));

const SignUpPage = (await import("@/app/(auth)/sign-up/[[...sign-up]]/page")).default;

const NEW_STUDENT = {
	firstName: "Ola",
	lastName: "Nordmann",
	email: "ola@uio.no",
};

const signUpFormSecret = "not-a-real-value-1234";

const EXPECTED_PAYLOAD = {
	externalId: CREATED_USER_ID,
	name: `${NEW_STUDENT.firstName} ${NEW_STUDENT.lastName}`,
	studyProgram: STUDY_PROGRAMS[0],
	degree: DEGREE_TYPES[1],
	year: 1,
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

async function settle() {
	for (let tick = 0; tick < 5; tick++) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}
}

async function reachVerificationStep() {
	fireEvent.change(screen.getByLabelText("Fornavn"), {
		target: { value: NEW_STUDENT.firstName },
	});
	fireEvent.change(screen.getByLabelText("Etternavn"), {
		target: { value: NEW_STUDENT.lastName },
	});
	fireEvent.change(screen.getByLabelText("Epost"), { target: { value: NEW_STUDENT.email } });
	fireEvent.change(screen.getByLabelText("Passord"), { target: { value: signUpFormSecret } });
	fireEvent.change(screen.getByLabelText("Bekreft passord"), {
		target: { value: signUpFormSecret },
	});

	fireEvent.click(screen.getByRole("button", { name: "Opprett ny bruker" }));

	await screen.findByRole("button", { name: "Fullfør oppretting" });
}

async function submitVerificationCode() {
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
	fireEvent.click(screen.getByRole("button", { name: "Fullfør oppretting" }));

	await waitFor(() => expect(setActive).toHaveBeenCalled());
}

beforeEach(() => {
	clerkState.isSignedIn = false;
	convexAuthState.isAuthenticated = false;
	signUpState.verificationStatus = "complete";
	mutationReferences.length = 0;
	createStudent.mockReset().mockResolvedValue(undefined);
	routerPush.mockReset();
	postHogCapture.mockReset();
	setActive.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("sign-up page waits for Convex auth before creating the student profile", () => {
	it("wires the student mutation to createByExternalId", () => {
		render(<SignUpPage />);

		const names = mutationReferences.map((reference) =>
			getFunctionName(reference as FunctionReference<"mutation">),
		);

		expect(names).toContain(getFunctionName(api.users.students.mutations.createByExternalId));
	});

	it("holds the profile back while Convex reports an unauthenticated session", async () => {
		render(<SignUpPage />);
		await reachVerificationStep();
		await submitVerificationCode();
		await settle();

		expect(createStudent).not.toHaveBeenCalled();
		expect(routerPush).not.toHaveBeenCalled();
	});

	it("creates the profile exactly once when the session becomes authenticated", async () => {
		const { rerender } = render(<SignUpPage />);
		await reachVerificationStep();
		await submitVerificationCode();
		expect(createStudent).not.toHaveBeenCalled();

		convexAuthState.isAuthenticated = true;
		rerender(<SignUpPage />);

		await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
		expect(createStudent).toHaveBeenCalledWith(EXPECTED_PAYLOAD);
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
	});

	it("creates the profile once even when the effect reruns while the call is in flight", async () => {
		const inFlight = deferred<null>();
		createStudent.mockReturnValue(inFlight.promise);

		const { rerender } = render(<SignUpPage />);
		await reachVerificationStep();
		await submitVerificationCode();

		convexAuthState.isAuthenticated = true;
		rerender(<SignUpPage />);
		await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));

		rerender(<SignUpPage />);
		rerender(<SignUpPage />);
		await settle();

		expect(createStudent).toHaveBeenCalledTimes(1);

		await act(async () => {
			inFlight.resolve(null);
			await inFlight.promise;
		});

		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
		expect(createStudent).toHaveBeenCalledTimes(1);
	});

	it("does not create the profile again on a later rerender", async () => {
		const { rerender } = render(<SignUpPage />);
		await reachVerificationStep();
		await submitVerificationCode();

		convexAuthState.isAuthenticated = true;
		rerender(<SignUpPage />);
		await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));

		rerender(<SignUpPage />);
		rerender(<SignUpPage />);
		await settle();

		expect(createStudent).toHaveBeenCalledTimes(1);
	});

	it("shows the server message and stays put when creating the profile fails", async () => {
		createStudent.mockRejectedValue(new ConvexError("Studenten finnes allerede."));

		const { rerender } = render(<SignUpPage />);
		await reachVerificationStep();
		await submitVerificationCode();

		convexAuthState.isAuthenticated = true;
		rerender(<SignUpPage />);

		await screen.findByText("Studenten finnes allerede.");
		expect(routerPush).not.toHaveBeenCalled();
	});

	it("creates the profile on the second try when the user retries a failed attempt", async () => {
		createStudent.mockRejectedValueOnce(new ConvexError("Studenten finnes allerede."));

		const { rerender } = render(<SignUpPage />);
		await reachVerificationStep();
		await submitVerificationCode();

		convexAuthState.isAuthenticated = true;
		rerender(<SignUpPage />);
		await screen.findByText("Studenten finnes allerede.");

		fireEvent.click(
			screen.getByRole("button", { name: "Prøv å opprette studentprofilen på nytt" }),
		);

		await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(2));
		expect(createStudent).toHaveBeenLastCalledWith(EXPECTED_PAYLOAD);
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
	});

	it("never reaches the profile step when the verification code is rejected", async () => {
		signUpState.verificationStatus = "missing_requirements";

		render(<SignUpPage />);
		await reachVerificationStep();

		fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: "Fullfør oppretting" }));

		await screen.findByText("Verifisering mislyktes. Vennligst prøv igjen.");

		convexAuthState.isAuthenticated = true;
		await settle();

		expect(createStudent).not.toHaveBeenCalled();
	});

	it("sends an already signed in visitor home without rendering the form", () => {
		clerkState.isSignedIn = true;

		const { container } = render(<SignUpPage />);

		expect(container.innerHTML).toBe("");
		expect(routerPush).toHaveBeenCalledWith("/");
	});
});
