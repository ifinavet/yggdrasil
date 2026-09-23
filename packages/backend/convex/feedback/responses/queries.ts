import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { getFeedbackTokenForm } from "./access";

export const getTokenForm = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: getFeedbackTokenForm,
});
