import { featureFlags } from "@workspace/shared/feature-flags";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureGate } from "./feature-gate";

const released = featureFlags.semesterPlanning.uiEnabled;

function render() {
	return renderToString(
		<FeatureGate feature="semesterPlanning" fallback={<span>fallback</span>}>
			<span>content</span>
		</FeatureGate>,
	);
}

describe("FeatureGate", () => {
	afterEach(() => {
		featureFlags.semesterPlanning.uiEnabled = released;
	});

	it("renders the children on the server once the feature is released", () => {
		featureFlags.semesterPlanning.uiEnabled = true;

		expect(render()).toBe("<span>content</span>");
	});

	it("renders nothing on the server before hydration while the feature is unreleased", () => {
		featureFlags.semesterPlanning.uiEnabled = false;

		expect(render()).toBe("");
	});
});
