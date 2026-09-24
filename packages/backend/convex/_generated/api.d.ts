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
import type * as companies_helper from "../companies/helper.js";
import type * as companies_mutations from "../companies/mutations.js";
import type * as companies_queries from "../companies/queries.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as events_helper from "../events/helper.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_queries from "../events/queries.js";
import type * as events_registrations_mutations from "../events/registrations/mutations.js";
import type * as events_registrations_queries from "../events/registrations/queries.js";
import type * as events_registrations_statistics from "../events/registrations/statistics.js";
import type * as events_waitlist_mutations from "../events/waitlist/mutations.js";
import type * as feedback_defaultFields from "../feedback/defaultFields.js";
import type * as feedback_delivery_campaigns from "../feedback/delivery/campaigns.js";
import type * as feedback_delivery_content from "../feedback/delivery/content.js";
import type * as feedback_delivery_emailContext from "../feedback/delivery/emailContext.js";
import type * as feedback_delivery_http from "../feedback/delivery/http.js";
import type * as feedback_delivery_mail from "../feedback/delivery/mail.js";
import type * as feedback_delivery_messages from "../feedback/delivery/messages.js";
import type * as feedback_delivery_status from "../feedback/delivery/status.js";
import type * as feedback_delivery_workflows from "../feedback/delivery/workflows.js";
import type * as feedback_events from "../feedback/events.js";
import type * as feedback_forms_helpers from "../feedback/forms/helpers.js";
import type * as feedback_forms_mutations from "../feedback/forms/mutations.js";
import type * as feedback_forms_queries from "../feedback/forms/queries.js";
import type * as feedback_manualSend_eligibility from "../feedback/manualSend/eligibility.js";
import type * as feedback_manualSend_send from "../feedback/manualSend/send.js";
import type * as feedback_reports_access from "../feedback/reports/access.js";
import type * as feedback_reports_build from "../feedback/reports/build.js";
import type * as feedback_reports_mail from "../feedback/reports/mail.js";
import type * as feedback_reports_messages from "../feedback/reports/messages.js";
import type * as feedback_reports_mutations from "../feedback/reports/mutations.js";
import type * as feedback_reports_public from "../feedback/reports/public.js";
import type * as feedback_reports_queries from "../feedback/reports/queries.js";
import type * as feedback_responses_access from "../feedback/responses/access.js";
import type * as feedback_responses_actions from "../feedback/responses/actions.js";
import type * as feedback_responses_mutations from "../feedback/responses/mutations.js";
import type * as feedback_responses_queries from "../feedback/responses/queries.js";
import type * as feedback_testSend_access from "../feedback/testSend/access.js";
import type * as feedback_testSend_report from "../feedback/testSend/report.js";
import type * as feedback_testSend_send from "../feedback/testSend/send.js";
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
import type * as semesterPlanning_applications_helper from "../semesterPlanning/applications/helper.js";
import type * as semesterPlanning_applications_mutations from "../semesterPlanning/applications/mutations.js";
import type * as semesterPlanning_applications_queries from "../semesterPlanning/applications/queries.js";
import type * as semesterPlanning_applications_submit from "../semesterPlanning/applications/submit.js";
import type * as semesterPlanning_offers_helper from "../semesterPlanning/offers/helper.js";
import type * as semesterPlanning_offers_messages from "../semesterPlanning/offers/messages.js";
import type * as semesterPlanning_offers_mutations from "../semesterPlanning/offers/mutations.js";
import type * as semesterPlanning_offers_queries from "../semesterPlanning/offers/queries.js";
import type * as semesterPlanning_rateLimits from "../semesterPlanning/rateLimits.js";
import type * as semesterPlanning_registry_actions from "../semesterPlanning/registry/actions.js";
import type * as semesterPlanning_registry_client from "../semesterPlanning/registry/client.js";
import type * as semesterPlanning_registry_messages from "../semesterPlanning/registry/messages.js";
import type * as semesterPlanning_rules from "../semesterPlanning/rules.js";
import type * as semesterPlanning_semesters_helper from "../semesterPlanning/semesters/helper.js";
import type * as semesterPlanning_semesters_mutations from "../semesterPlanning/semesters/mutations.js";
import type * as semesterPlanning_semesters_queries from "../semesterPlanning/semesters/queries.js";
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
  "companies/helper": typeof companies_helper;
  "companies/mutations": typeof companies_mutations;
  "companies/queries": typeof companies_queries;
  crons: typeof crons;
  emails: typeof emails;
  "events/helper": typeof events_helper;
  "events/mutations": typeof events_mutations;
  "events/queries": typeof events_queries;
  "events/registrations/mutations": typeof events_registrations_mutations;
  "events/registrations/queries": typeof events_registrations_queries;
  "events/registrations/statistics": typeof events_registrations_statistics;
  "events/waitlist/mutations": typeof events_waitlist_mutations;
  "feedback/defaultFields": typeof feedback_defaultFields;
  "feedback/delivery/campaigns": typeof feedback_delivery_campaigns;
  "feedback/delivery/content": typeof feedback_delivery_content;
  "feedback/delivery/emailContext": typeof feedback_delivery_emailContext;
  "feedback/delivery/http": typeof feedback_delivery_http;
  "feedback/delivery/mail": typeof feedback_delivery_mail;
  "feedback/delivery/messages": typeof feedback_delivery_messages;
  "feedback/delivery/status": typeof feedback_delivery_status;
  "feedback/delivery/workflows": typeof feedback_delivery_workflows;
  "feedback/events": typeof feedback_events;
  "feedback/forms/helpers": typeof feedback_forms_helpers;
  "feedback/forms/mutations": typeof feedback_forms_mutations;
  "feedback/forms/queries": typeof feedback_forms_queries;
  "feedback/manualSend/eligibility": typeof feedback_manualSend_eligibility;
  "feedback/manualSend/send": typeof feedback_manualSend_send;
  "feedback/reports/access": typeof feedback_reports_access;
  "feedback/reports/build": typeof feedback_reports_build;
  "feedback/reports/mail": typeof feedback_reports_mail;
  "feedback/reports/messages": typeof feedback_reports_messages;
  "feedback/reports/mutations": typeof feedback_reports_mutations;
  "feedback/reports/public": typeof feedback_reports_public;
  "feedback/reports/queries": typeof feedback_reports_queries;
  "feedback/responses/access": typeof feedback_responses_access;
  "feedback/responses/actions": typeof feedback_responses_actions;
  "feedback/responses/mutations": typeof feedback_responses_mutations;
  "feedback/responses/queries": typeof feedback_responses_queries;
  "feedback/testSend/access": typeof feedback_testSend_access;
  "feedback/testSend/report": typeof feedback_testSend_report;
  "feedback/testSend/send": typeof feedback_testSend_send;
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
  "semesterPlanning/applications/helper": typeof semesterPlanning_applications_helper;
  "semesterPlanning/applications/mutations": typeof semesterPlanning_applications_mutations;
  "semesterPlanning/applications/queries": typeof semesterPlanning_applications_queries;
  "semesterPlanning/applications/submit": typeof semesterPlanning_applications_submit;
  "semesterPlanning/offers/helper": typeof semesterPlanning_offers_helper;
  "semesterPlanning/offers/messages": typeof semesterPlanning_offers_messages;
  "semesterPlanning/offers/mutations": typeof semesterPlanning_offers_mutations;
  "semesterPlanning/offers/queries": typeof semesterPlanning_offers_queries;
  "semesterPlanning/rateLimits": typeof semesterPlanning_rateLimits;
  "semesterPlanning/registry/actions": typeof semesterPlanning_registry_actions;
  "semesterPlanning/registry/client": typeof semesterPlanning_registry_client;
  "semesterPlanning/registry/messages": typeof semesterPlanning_registry_messages;
  "semesterPlanning/rules": typeof semesterPlanning_rules;
  "semesterPlanning/semesters/helper": typeof semesterPlanning_semesters_helper;
  "semesterPlanning/semesters/mutations": typeof semesterPlanning_semesters_mutations;
  "semesterPlanning/semesters/queries": typeof semesterPlanning_semesters_queries;
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
  feedbackResend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"feedbackResend">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
