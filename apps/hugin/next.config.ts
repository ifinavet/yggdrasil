import { createNextConfig } from "@workspace/next-config";

export default createNextConfig({
	project: "hugin",
	widenClientFileUpload: false,
	devIndicators: false,
});
