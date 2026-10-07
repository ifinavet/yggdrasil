import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft } from "@/lib/company-application";
import { loadDraft } from "@/lib/company-application-storage";
import { useDraftAutosave } from "./use-draft-autosave";

let startedWith: string | undefined;
let type: (description: string) => void = () => {};
let switchTo: (semesterId: string, saveFirst: boolean) => void = () => {};

/** Stands in for the application form: reads its draft as it mounts and autosaves the answers. */
function Form({
	semesterId,
	onSwitch,
}: Readonly<{ semesterId: string; onSwitch: (id: string, save?: () => void) => void }>) {
	const [initial] = useState(
		() => loadDraft(semesterId) ?? { submissionId: `${semesterId}-id`, values: emptyDraft() },
	);
	const [values, setValues] = useState(initial.values);
	const sent = useRef(false);
	const saveDraftNow = useDraftAutosave(
		{ semesterId, submissionId: initial.submissionId, values },
		sent,
	);
	startedWith = initial.values.description;
	type = (description) => setValues((current) => ({ ...current, description }));
	switchTo = (id, saveFirst) => onSwitch(id, saveFirst ? saveDraftNow : undefined);
	return null;
}

function Picker() {
	const [semesterId, setSemesterId] = useState("spring");
	return (
		<Form
			key={semesterId}
			semesterId={semesterId}
			onSwitch={(id, save) => {
				save?.();
				setSemesterId(id);
			}}
		/>
	);
}

describe("useDraftAutosave", () => {
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		vi.useFakeTimers();
		const items = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => items.get(key) ?? null,
			setItem: (key: string, value: string) => items.set(key, value),
			removeItem: (key: string) => items.delete(key),
		});
		root = createRoot(document.createElement("div"));
		act(() => root.render(<Picker />));
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("carries the latest answers to the next semester when saved before switching", () => {
		act(() => type("Skrevet rett før byttet"));
		act(() => switchTo("autumn", true));

		expect(startedWith).toBe("Skrevet rett før byttet");
	});

	it("would start the next semester from older answers without saving first", () => {
		act(() => type("Skrevet rett før byttet"));
		act(() => switchTo("autumn", false));

		expect(startedWith).not.toBe("Skrevet rett før byttet");
	});
});
