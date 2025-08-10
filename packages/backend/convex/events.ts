import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, type QueryCtx, query } from "./_generated/server";
import { getCurrentUserOrThrow, userByExternalId } from "./users";

// Shared validator for organizer roles
const organizerRoleValidator = v.union(v.literal("hovedansvarlig"), v.literal("medhjelper"));
type OrganizerRole = "hovedansvarlig" | "medhjelper";

export const getLatest = query({
  args: {
    n: v.number(),
  },
  handler: async (ctx, { n }) => {
    const firstDayOfThisWeek = new Date(
      new Date().setDate(new Date().getDate() - new Date().getDay()),
    );

    const events = await ctx.db
      .query("events")
      .withIndex("by_eventStart")
      .filter((q) => q.eq(q.field("published"), true))
      .filter((q) => q.gte(q.field("eventStart"), firstDayOfThisWeek.getTime()))
      .order("asc")
      .take(n);

    const eventWithOrganizers = await Promise.all(
      events.map(async (event) => {
        const organizers = await getOrganizers(ctx, event._id);

        return { ...event, organizers };
      }),
    );

    return eventWithOrganizers;
  },
});

export const getAllEvents = internalQuery({
  args: { semester: v.number(), year: v.number() },
  handler: async (ctx, { semester, year }) => {
    let range_start: Date;
    let range_end: Date;
    if (!semester) {
      range_start = new Date(year, 0, 1);
      range_end = new Date(year, 6, 30);
    } else {
      range_start = new Date(year, 7, 1);
      range_end = new Date(year, 11, 31);
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_eventStart")
      .filter((q) => q.gte(q.field("eventStart"), range_start.getTime()))
      .filter((q) => q.lte(q.field("eventStart"), range_end.getTime()))
      .order("asc")
      .collect();

    const eventsWithCompany = await Promise.all(
      events.map(async (event) => {
        const company = await ctx.db.get(event.hostingCompany);
        return { ...event, hostingCompanyName: company?.name ?? "Ukjent" };
      }),
    );

    return eventsWithCompany;
  },
});

export const getAll = query({
  args: {
    semester: v.string(),
    year: v.number(),
  },
  handler: async (ctx, { semester, year }) => {
    const semesterNumber = semester === "vår" ? 0 : 1; // 0 for spring, 1 for fall

    const events: Array<Doc<"events"> & { hostingCompanyName: string }> = await ctx.runQuery(internal.events.getAllEvents, {
      semester: semesterNumber,
      year,
    })

    const published = events.filter((event) => event.published);
    const unpublished = events.filter((event) => !event.published);
    return { published, unpublished };
  },
});

export const getCurrentSemester = query({
  args: {
    isExternal: v.boolean(),
  },
  handler: async (ctx, { isExternal }) => {
    const semester = Date.now() < new Date().setMonth(7) ? 0 : 1; // 0 for spring, 1 for fall

    const events: Array<Doc<"events"> & { hostingCompanyName: string }> = (
      await ctx.runQuery(internal.events.getAllEvents, {
        semester,
        year: new Date().getFullYear(),
      }))
      .filter(q => q.published === true);

    const filteredEvents = isExternal
      ? events.filter((event) => event.externalUrl && event.externalUrl.length > 0)
      : events.filter((event) => event.externalUrl === undefined || event.externalUrl.length === 0);

    const eventsWithParticipationCount = await Promise.all(
      filteredEvents.map(async (event) => {
        const participationCount = (
          await ctx.db
            .query("registrations")
            .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
            .filter((q) => q.eq(q.field("status"), "registered"))
            .collect()
        ).length;

        return { ...event, participationCount };
      }),
    );

    const monthNames = [
      "januar", "februar", "mars", "april", "mai", "juni",
      "juli", "august", "september", "oktober", "november", "desember"
    ];

    const eventsByMonth: Record<string, typeof eventsWithParticipationCount> = {};

    eventsWithParticipationCount.forEach(event => {
      const eventDate = new Date(event.eventStart);
      const monthName = monthNames[eventDate.getMonth()] as string;

      if (!eventsByMonth[monthName]) {
        eventsByMonth[monthName] = [];
      }
      eventsByMonth[monthName].push(event);
    });

    return eventsByMonth;
  },
});

export const getById = query({
  args: {
    id: v.id("events"),
  },
  handler: async (ctx, { id }) => {
    const event = await ctx.db.get(id);
    if (!event) {
      throw new Error("Event not found");
    }
    const company = await ctx.db.get(event.hostingCompany);
    if (!company) {
      throw new Error("Company not found");
    }

    const organizers = await getOrganizers(ctx, event._id);

    return { ...event, hostingCompanyName: company?.name ?? "Ukjent", organizers };
  },
});

async function getOrganizers(ctx: QueryCtx, eventId: Id<"events">) {
  const organizers = await ctx.db
    .query("eventOrganizers")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect();

  const organizersWithName = await Promise.all(
    organizers.map(async (organizer) => {
      const user = await ctx.db.get(organizer.userId);
      if (!user)
        return {
          id: organizer._id,
          name: "Ukjent ansvarlig",
          role: "medhjelper" as OrganizerRole,
          externalId: "",
          imageUrl: "",
          email: "",
        };

      return {
        id: organizer._id,
        name: `${user.firstName} ${user.lastName}`,
        role: organizer.role,
        externalId: user.externalId,
        imageUrl: user.image,
        email: user.email,
      };
    }),
  );

  return organizersWithName;
}

export const getPossibleSemesters = query({
  handler: async (ctx) => {
    const firstEvent = await ctx.db.query("events").withIndex("by_eventStart").order("asc").first();
    const lastEvent = await ctx.db.query("events").withIndex("by_eventStart").order("desc").first();

    if (!firstEvent || !lastEvent) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      return [
        { year: currentYear, semester: currentMonth < 6 ? "vår" : "høst" },
      ]
    }

    const firstYear = new Date(firstEvent.eventStart).getFullYear();
    const lastYear = new Date(lastEvent.eventStart).getFullYear();

    const possibleSemesters = [];
    for (let year = firstYear; year <= lastYear; year++) {
      possibleSemesters.push({ year, semester: "vår" }, { year, semester: "høst" });
    }

    return possibleSemesters;
  },
});

export const getOrganizersByEventId = query({
  args: {
    id: v.id("events"),
  },
  handler: async (ctx, { id }) => {
    const organizers = await ctx.db
      .query("eventOrganizers")
      .withIndex("by_eventId", (q) => q.eq("eventId", id))
      .collect();
    const organizersWithName = await Promise.all(
      organizers.map(async (organizer) => {
        const user = await ctx.db.get(organizer.userId);
        return {
          ...organizer,
          name: `${user?.firstName ?? "Ukjent"} ${user?.lastName ?? "Ansvarlig"}`,
        };
      }),
    );
    return organizersWithName;
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    title: v.string(),
    teaser: v.string(),
    description: v.string(),
    eventStart: v.number(),
    registrationOpens: v.number(),
    participationLimit: v.number(),
    location: v.string(),
    food: v.string(),
    language: v.string(),
    ageRestriction: v.string(),
    externalUrl: v.optional(v.string()),
    hostingCompany: v.id("companies"),
    published: v.boolean(),
    organizers: v.array(
      v.object({
        externalUserId: v.string(),
        role: organizerRoleValidator,
      }),
    ),
  },
  handler: async (
    ctx,
    {
      id: eventId,
      title,
      teaser,
      description,
      eventStart,
      registrationOpens,
      participationLimit,
      location,
      food,
      language,
      ageRestriction,
      externalUrl,
      hostingCompany,
      published,
      organizers,
    },
  ) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthenticated call to mutation");
    }

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Update the event details
    await ctx.db.replace(eventId, {
      title,
      teaser,
      description,
      eventStart,
      registrationOpens,
      participationLimit,
      location,
      food,
      language,
      ageRestriction,
      externalUrl,
      hostingCompany,
      published,
    });

    const currentOrganizers = await ctx.db
      .query("eventOrganizers")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .collect();

    const inputUserIdToRole = new Map<Id<"users">, OrganizerRole>();
    for (const { externalUserId, role } of organizers) {
      const user = await userByExternalId(ctx, externalUserId);
      if (!user) {
        throw new Error(`User not found: ${externalUserId}`);
      }
      inputUserIdToRole.set(user._id, role);
    }

    const currentOrganizersByUserId = new Map(currentOrganizers.map((org) => [org.userId, org]));

    // Remove organizers that are no longer in the input
    const organizersToDelete = currentOrganizers
      .filter((org) => !inputUserIdToRole.has(org.userId))
      .map((org) => ctx.db.delete(org._id));

    // Update existing organizers with role changes
    const organizersToUpdate = currentOrganizers
      .filter((org) => {
        const newRole = inputUserIdToRole.get(org.userId);
        return newRole !== undefined && newRole !== org.role;
      })
      .map((org) => {
        const newRole = inputUserIdToRole.get(org.userId);
        if (newRole === undefined) {
          return Promise.resolve();
        }
        return ctx.db.patch(org._id, { role: newRole });
      });

    // Create new organizers for users not currently organizing the event
    const organizersToCreate = Array.from(inputUserIdToRole.entries())
      .filter(([userId]) => !currentOrganizersByUserId.has(userId))
      .map(([userId, role]) => {
        return ctx.db.insert("eventOrganizers", {
          eventId: eventId,
          userId: userId,
          role,
        });
      });

    await Promise.all([...organizersToDelete, ...organizersToUpdate, ...organizersToCreate]);
  },
});

export const updatePublishedStatus = mutation({
  args: {
    ids: v.array(v.id("events")),
    newPublishedStatus: v.boolean(),
  },
  handler: async (ctx, { ids, newPublishedStatus }) => {
    await getCurrentUserOrThrow(ctx);

    await Promise.all(ids.map(async (id) => {
      await ctx.db.patch(id, { published: newPublishedStatus });
    }))
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    teaser: v.string(),
    description: v.string(),
    eventStart: v.number(),
    registrationOpens: v.number(),
    participationLimit: v.number(),
    location: v.string(),
    food: v.string(),
    language: v.string(),
    ageRestriction: v.string(),
    externalUrl: v.optional(v.string()),
    hostingCompany: v.id("companies"),
    published: v.boolean(),
    organizers: v.array(
      v.object({
        externalUserId: v.string(),
        role: organizerRoleValidator,
      }),
    ),
  },
  handler: async (
    ctx,
    {
      title,
      teaser,
      description,
      eventStart,
      registrationOpens,
      participationLimit,
      location,
      food,
      language,
      ageRestriction,
      externalUrl,
      hostingCompany,
      published,
      organizers,
    },
  ) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthenticated call to mutation");
    }

    const eventId = await ctx.db.insert("events", {
      title,
      teaser,
      description,
      eventStart,
      registrationOpens,
      participationLimit,
      location,
      food,
      language,
      ageRestriction,
      externalUrl,
      hostingCompany,
      published,
    });

    await Promise.all(
      organizers.map(async ({ externalUserId, role }) => {
        const user = await userByExternalId(ctx, externalUserId);
        if (!user) {
          throw new Error(`User not found: ${externalUserId}`);
        }
        return ctx.db.insert("eventOrganizers", {
          eventId,
          userId: user._id,
          role,
        });
      }),
    );
  },
});
