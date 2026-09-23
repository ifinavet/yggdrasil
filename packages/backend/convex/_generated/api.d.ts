/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_accessRights from "../auth/accessRights.js";
import type * as auth_currentUser from "../auth/currentUser.js";
import type * as auth_local from "../auth/local.js";
import type * as companies_mutations from "../companies/mutations.js";
import type * as companies_queries from "../companies/queries.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as events_helper from "../events/helper.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_queries from "../events/queries.js";
import type * as events_registrations_mutations from "../events/registrations/mutations.js";
import type * as events_registrations_queries from "../events/registrations/queries.js";
import type * as events_waitlist_mutations from "../events/waitlist/mutations.js";
import type * as feedback_defaultFields from "../feedback/defaultFields.js";
import type * as feedback_events from "../feedback/events.js";
import type * as feedback_forms_helpers from "../feedback/forms/helpers.js";
import type * as feedback_forms_mutations from "../feedback/forms/mutations.js";
import type * as feedback_forms_queries from "../feedback/forms/queries.js";
import type * as feedback_responses_access from "../feedback/responses/access.js";
import type * as feedback_responses_actions from "../feedback/responses/actions.js";
import type * as feedback_responses_mutations from "../feedback/responses/mutations.js";
import type * as feedback_responses_queries from "../feedback/responses/queries.js";
import type * as forms_access from "../forms/access.js";
import type * as forms_migrations from "../forms/migrations.js";
import type * as forms_mutations from "../forms/mutations.js";
import type * as forms_queries from "../forms/queries.js";
import type * as forms_responses from "../forms/responses.js";
import type * as http from "../http.js";
import type * as jobListings_mutations from "../jobListings/mutations.js";
import type * as jobListings_queries from "../jobListings/queries.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as migrations from "../migrations.js";
import type * as pages_mutations from "../pages/mutations.js";
import type * as pages_queries from "../pages/queries.js";
import type * as points_mutations from "../points/mutations.js";
import type * as points_queries from "../points/queries.js";
import type * as semesterPlanning_applicationLifecycle from "../semesterPlanning/applicationLifecycle.js";
import type * as semesterPlanning_rules from "../semesterPlanning/rules.js";
import type * as users_clerk_http from "../users/clerk/http.js";
import type * as users_clerk_mutations from "../users/clerk/mutations.js";
import type * as users_clerk_queries from "../users/clerk/queries.js";
import type * as users_organization_mutations from "../users/organization/mutations.js";
import type * as users_organization_queries from "../users/organization/queries.js";
import type * as users_students_mutations from "../users/students/mutations.js";
import type * as users_students_queries from "../users/students/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/accessRights": typeof auth_accessRights;
  "auth/currentUser": typeof auth_currentUser;
  "auth/local": typeof auth_local;
  "companies/mutations": typeof companies_mutations;
  "companies/queries": typeof companies_queries;
  crons: typeof crons;
  emails: typeof emails;
  "events/helper": typeof events_helper;
  "events/mutations": typeof events_mutations;
  "events/queries": typeof events_queries;
  "events/registrations/mutations": typeof events_registrations_mutations;
  "events/registrations/queries": typeof events_registrations_queries;
  "events/waitlist/mutations": typeof events_waitlist_mutations;
  "feedback/defaultFields": typeof feedback_defaultFields;
  "feedback/events": typeof feedback_events;
  "feedback/forms/helpers": typeof feedback_forms_helpers;
  "feedback/forms/mutations": typeof feedback_forms_mutations;
  "feedback/forms/queries": typeof feedback_forms_queries;
  "feedback/responses/access": typeof feedback_responses_access;
  "feedback/responses/actions": typeof feedback_responses_actions;
  "feedback/responses/mutations": typeof feedback_responses_mutations;
  "feedback/responses/queries": typeof feedback_responses_queries;
  "forms/access": typeof forms_access;
  "forms/migrations": typeof forms_migrations;
  "forms/mutations": typeof forms_mutations;
  "forms/queries": typeof forms_queries;
  "forms/responses": typeof forms_responses;
  http: typeof http;
  "jobListings/mutations": typeof jobListings_mutations;
  "jobListings/queries": typeof jobListings_queries;
  "lib/tokens": typeof lib_tokens;
  migrations: typeof migrations;
  "pages/mutations": typeof pages_mutations;
  "pages/queries": typeof pages_queries;
  "points/mutations": typeof points_mutations;
  "points/queries": typeof points_queries;
  "semesterPlanning/applicationLifecycle": typeof semesterPlanning_applicationLifecycle;
  "semesterPlanning/rules": typeof semesterPlanning_rules;
  "users/clerk/http": typeof users_clerk_http;
  "users/clerk/mutations": typeof users_clerk_mutations;
  "users/clerk/queries": typeof users_clerk_queries;
  "users/organization/mutations": typeof users_organization_mutations;
  "users/organization/queries": typeof users_organization_queries;
  "users/students/mutations": typeof users_students_mutations;
  "users/students/queries": typeof users_students_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
