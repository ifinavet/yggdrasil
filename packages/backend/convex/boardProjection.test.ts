/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertInternal,
	insertUser,
	setup,
	type TestBackend,
} from "../test/fixtures";
import { api } from "./_generated/api";

const PUBLIC_BOARD_LIST_FIELDS = [
	"_id",
	"position",
	"group",
	"positionEmail",
	"fullName",
	"email",
	"image",
];

const PUBLIC_BOARD_MEMBER_FIELDS = [
	"_id",
	"position",
	"group",
	"positionEmail",
	"firstName",
	"lastName",
	"email",
	"image",
];

const PRIVATE_USER_FIELDS = ["externalId", "locked", "userId", "rank", "_creationTime"];

async function insertBoardMember(
	t: TestBackend,
	email: string,
	position: string,
	rank?: number,
) {
	const user = await insertUser(t, email);
	await insertInternal(t, user._id, position, { rank, positionEmail: email });
	return user;
}

describe("users.organization.queries.getTheBoard", () => {
	it("returns the public projection for a board member", async () => {
		const { t } = await setup();
		await insertBoardMember(t, "leder@example.com", "Leder", 1);

		const board = await t.query(api.users.organization.queries.getTheBoard, {});

		expect(board).toHaveLength(1);
		expect(Object.keys(board[0]).sort()).toEqual([...PUBLIC_BOARD_LIST_FIELDS].sort());
		expect(board[0].fullName).toBe("Test Testesen");
		expect(board[0].position).toBe("Leder");
	});

	it("never leaks the user document behind the board member", async () => {
		const { t } = await setup();
		await insertBoardMember(t, "leder@example.com", "Leder", 1);

		const board = await t.query(api.users.organization.queries.getTheBoard, {});

		for (const field of PRIVATE_USER_FIELDS) {
			expect(board[0]).not.toHaveProperty(field);
		}
	});

	it("orders ranked members first and leaves unranked members last", async () => {
		const { t } = await setup();
		await insertBoardMember(t, "uranger@example.com", "Styremedlem");
		await insertBoardMember(t, "nestleder@example.com", "Nestleder", 2);
		await insertBoardMember(t, "leder@example.com", "Leder", 1);

		const board = await t.query(api.users.organization.queries.getTheBoard, {});

		expect(board.map((member) => member.position)).toEqual([
			"Leder",
			"Nestleder",
			"Styremedlem",
		]);
	});

	it("leaves plain internals out of the board", async () => {
		const { t } = await setup();
		await insertBoardMember(t, "intern@example.com", "Intern");

		const board = await t.query(api.users.organization.queries.getTheBoard, {});

		expect(board).toEqual([]);
	});
});

describe("users.organization.queries.getBoardMemberByPosition", () => {
	it("returns the public projection for the position", async () => {
		const { t } = await setup();
		await insertBoardMember(t, "leder@example.com", "Leder", 1);

		const member = await t.query(api.users.organization.queries.getBoardMemberByPosition, {
			position: "Leder",
		});

		expect(member).not.toBeNull();
		expect(Object.keys(member ?? {}).sort()).toEqual([...PUBLIC_BOARD_MEMBER_FIELDS].sort());
	});

	it("never leaks the user document behind the position", async () => {
		const { t } = await setup();
		await insertBoardMember(t, "leder@example.com", "Leder", 1);

		const member = await t.query(api.users.organization.queries.getBoardMemberByPosition, {
			position: "Leder",
		});

		for (const field of PRIVATE_USER_FIELDS) {
			expect(member).not.toHaveProperty(field);
		}
	});

	it("returns null for a position nobody holds", async () => {
		const { t } = await setup();

		const member = await t.query(api.users.organization.queries.getBoardMemberByPosition, {
			position: "Leder",
		});

		expect(member).toBeNull();
	});
});

describe("users.organization.queries.getById", () => {
	it("still gives an admin the internal fields the public board hides", async () => {
		const { t } = await setup();
		const boardMember = await insertUser(t, "leder@example.com");
		const internalId = await insertInternal(t, boardMember._id, "Leder", { rank: 1 });
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");

		const member = await asUser(t, admin).query(api.users.organization.queries.getById, {
			id: internalId,
		});

		expect(member.userId).toBe(boardMember._id);
		expect(member.rank).toBe(1);
		expect(member.email).toBe("leder@example.com");
	});
});
