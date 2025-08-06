import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { userByExternalId } from "./users";

export const getBoardMembers = query({
  handler: async (ctx) => {
    const members = await ctx.db.query("internals").filter(q => q.neq("position", "intern")).collect();
    const membersWithUserData = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        if (!user) {
          throw new Error(`User not found for member with ID: ${member._id}`);
        }
        return {
          ...member,
          fullName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          image: user.image
        };
      }),
    );

    return membersWithUserData;
  },
})

export const getBoardMemberByPosition = query({
  args: {
    position: v.string(),
  },
  handler: async (ctx, { position }) => {
    const member = await ctx.db.query("internals")
      .withIndex("by_position", (q) => q.eq("position", position))
      .first();

    if (!member) {
      return null;
    }

    const user = await ctx.db.get(member.userId);
    if (!user) {
      throw new Error(`User not found for board member with ID: ${member._id}`);
    }

    return {
      ...member, ...user
    };
  }
});

export const getById = query({
  args: {
    id: v.id("internals"),
  },
  handler: async (ctx, { id }) => {
    const internal = await ctx.db.get(id);
    if (!internal) {
      throw new Error(`Internal record not found for ID: ${id}`);
    }

    const user = await ctx.db.get(internal.userId);
    if (!user) {
      throw new Error(`User not found for internal record with ID: ${id}`);
    }

    return {
      ...internal,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      image: user.image,
      externalId: user.externalId,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("internals"),
    externalId: v.string(),
    position: v.string(),
    group: v.string(),
    positionEmail: v.optional(v.string()),
  }, handler: async (ctx, { id, externalId, position, group, positionEmail }) => {
    const user = await userByExternalId(ctx, externalId);
    if (!user) {
      throw new Error(`User not found for external ID: ${externalId}`);
    }

    await ctx.db.patch(id, {
      userId: user._id,
      position,
      group,
      positionEmail,
    })
  }
})

export const createBoardMember = mutation({
  args: {
    externalId: v.string(),
    position: v.string(),
    group: v.string(),
    positionEmail: v.optional(v.string()),
  },
  handler: async (ctx, { externalId, position, group, positionEmail }) => {
    const user = await userByExternalId(ctx, externalId)
    if (!user) {
      throw new Error(`User not found for external ID: ${externalId}`);
    }

    const newMember = {
      userId: user._id,
      position,
      group,
      positionEmail,
    };

    await ctx.db.insert("internals", newMember);
  },
})
