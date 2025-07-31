/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as companies from "../companies.js";
import type * as events from "../events.js";
import type * as externalPages from "../externalPages.js";
import type * as http from "../http.js";
import type * as internals from "../internals.js";
import type * as listings from "../listings.js";
import type * as points from "../points.js";
import type * as registration from "../registration.js";
import type * as resources from "../resources.js";
import type * as students from "../students.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  companies: typeof companies;
  events: typeof events;
  externalPages: typeof externalPages;
  http: typeof http;
  internals: typeof internals;
  listings: typeof listings;
  points: typeof points;
  registration: typeof registration;
  resources: typeof resources;
  students: typeof students;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
