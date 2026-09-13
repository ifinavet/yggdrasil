/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
	asUser,
	givePointsTo,
	grantRole,
	insertStudent,
	insertUser,
	pointsFor,
	refusalMessageFrom,
	setup,
} from "../test/fixtures";
import { api } from "./_generated/api";

const ADMIN_ROLES_MESSAGE = "Krever rollen: super-admin eller admin.";

async function backendWithStudent() {
	const { t } = await setup();
	const subject = await insertUser(t, "student@example.com");
	const studentId = await insertStudent(t, subject._id);

	return { t, studentId };
}

describe("points.mutations.givePoints", () => {
	it("refuses a student without a role", async () => {
		const { t, studentId } = await backendWithStudent();
		const caller = await insertUser(t, "utenrolle@example.com");

		const message = await refusalMessageFrom(
			asUser(t, caller).mutation(api.points.mutations.givePoints, {
				id: studentId,
				severity: 1,
				reason: "For sen",
			}),
		);

		expect(message).toContain("Krever rollen: super-admin, admin eller internal.");
		expect(await pointsFor(t, studentId)).toHaveLength(0);
	});

	it("lets an internal give points", async () => {
		const { t, studentId } = await backendWithStudent();
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");

		await asUser(t, internalUser).mutation(api.points.mutations.givePoints, {
			id: studentId,
			severity: 1,
			reason: "For sen",
		});

		expect(await pointsFor(t, studentId)).toHaveLength(1);
	});
});

describe("points.mutations.remove", () => {
	it("refuses an internal", async () => {
		const { t, studentId } = await backendWithStudent();
		const pointId = await givePointsTo(t, studentId, 1);
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");

		const message = await refusalMessageFrom(
			asUser(t, internalUser).mutation(api.points.mutations.remove, { id: pointId }),
		);

		expect(message).toContain(ADMIN_ROLES_MESSAGE);
		expect(await pointsFor(t, studentId)).toHaveLength(1);
	});

	it("lets an admin remove a point", async () => {
		const { t, studentId } = await backendWithStudent();
		const pointId = await givePointsTo(t, studentId, 1);
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");

		await asUser(t, admin).mutation(api.points.mutations.remove, { id: pointId });

		expect(await pointsFor(t, studentId)).toHaveLength(0);
	});
});

describe("points.queries.getByStudentId", () => {
	it("refuses an internal and allows an admin", async () => {
		const { t, studentId } = await backendWithStudent();
		await givePointsTo(t, studentId, 2);
		const internalUser = await insertUser(t, "intern@example.com");
		await grantRole(t, internalUser._id, "internal");
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");

		const message = await refusalMessageFrom(
			asUser(t, internalUser).query(api.points.queries.getByStudentId, { id: studentId }),
		);
		expect(message).toContain(ADMIN_ROLES_MESSAGE);

		const points = await asUser(t, admin).query(api.points.queries.getByStudentId, {
			id: studentId,
		});
		expect(points).toHaveLength(1);
	});
});
