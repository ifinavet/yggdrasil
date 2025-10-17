import { type GenericCtx, getStaticAuth } from "@convex-dev/better-auth";
import { v } from "convex/values";
import type { DataModel } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { authComponent, createAuth } from "../auth";

// Export a static instance for Better Auth schema generation
export const auth = getStaticAuth(createAuth);
