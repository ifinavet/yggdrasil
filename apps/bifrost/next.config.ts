import { createNextConfig } from "@workspace/next-config";

export default createNextConfig({
	project: "bifrost",
	widenClientFileUpload: false,
	devIndicators: false,
});
