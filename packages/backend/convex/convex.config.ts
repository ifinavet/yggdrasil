import migrations from "@convex-dev/migrations/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
	env: { FEEDBACK_EMAILS_ENABLED: v.optional(v.string()), HUGIN_BASE_URL: v.optional(v.string()) },
});
app.use(resend);
// Resend stores callback options per component, so feedback needs its own delivery queue.
app.use(resend, { name: "feedbackResend" });
app.use(migrations);
app.use(rateLimiter);
app.use(workflow);

export default app;
