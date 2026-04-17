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
import type * as companies_mutations from "../companies/mutations.js";
import type * as companies_queries from "../companies/queries.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_queries from "../events/queries.js";
import type * as events_registrations_mutations from "../events/registrations/mutations.js";
import type * as events_registrations_queries from "../events/registrations/queries.js";
import type * as events_waitlist_mutations from "../events/waitlist/mutations.js";
import type * as forms_mutations from "../forms/mutations.js";
import type * as forms_queries from "../forms/queries.js";
import type * as jobListings_mutations from "../jobListings/mutations.js";
import type * as jobListings_queries from "../jobListings/queries.js";
import type * as pages_mutations from "../pages/mutations.js";
import type * as pages_queries from "../pages/queries.js";
import type * as points_mutations from "../points/mutations.js";
import type * as points_queries from "../points/queries.js";
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
  "companies/mutations": typeof companies_mutations;
  "companies/queries": typeof companies_queries;
  crons: typeof crons;
  emails: typeof emails;
  "events/mutations": typeof events_mutations;
  "events/queries": typeof events_queries;
  "events/registrations/mutations": typeof events_registrations_mutations;
  "events/registrations/queries": typeof events_registrations_queries;
  "events/waitlist/mutations": typeof events_waitlist_mutations;
  "forms/mutations": typeof forms_mutations;
  "forms/queries": typeof forms_queries;
  "jobListings/mutations": typeof jobListings_mutations;
  "jobListings/queries": typeof jobListings_queries;
  "pages/mutations": typeof pages_mutations;
  "pages/queries": typeof pages_queries;
  "points/mutations": typeof points_mutations;
  "points/queries": typeof points_queries;
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
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          createdAt: number;
          errorMessage?: string;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject: string;
          text?: string;
          to: string;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          errorMessage: string | null;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject: string;
          text?: string;
          to: string;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
};
