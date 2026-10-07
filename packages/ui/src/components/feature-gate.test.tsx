import { featureFlags } from "@workspace/shared/feature-flags";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { FeatureGate } from "./feature-gate";

const released = featureFlags.food.uiEnabled;

function render() {
	return renderToString(
		<FeatureGate feature="food" fallback={<span>fallback</span>}>
			<span>content</span>
		</FeatureGate>,
	);
}

describe("FeatureGate", () => {
	afterEach(() => {
		featureFlags.food.uiEnabled = released;
	});

	it("renders the children on the server once the feature is released", () => {
		featureFlags.food.uiEnabled = true;

		expect(render()).toBe("<span>content</span>");
	});

	it("renders nothing on the server before hydration while the feature is unreleased", () => {
		featureFlags.food.uiEnabled = false;

		expect(render()).toBe("");
	});
});
