import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";
import { LinkPopover } from "./link-popover";

type MockEditorOverrides = {
	readonly isEditable?: boolean;
	readonly hasLinkMark?: boolean;
	readonly isActive?: (name: string) => boolean;
	readonly href?: string;
};

function createMockEditor(overrides: MockEditorOverrides = {}) {
	const { isEditable = true, hasLinkMark = true, isActive = () => false, href = "" } = overrides;

	const chain = {
		focus: vi.fn(() => chain),
		extendMarkRange: vi.fn(() => chain),
		insertContent: vi.fn(() => chain),
		unsetMark: vi.fn(() => chain),
		setMeta: vi.fn(() => chain),
		run: vi.fn(() => true),
	};

	const editor = {
		isEditable,
		schema: {
			spec: {
				marks: new Map(hasLinkMark ? [["link", {}]] : []),
			},
		},
		isActive: vi.fn(isActive),
		getAttributes: vi.fn(() => ({ href })),
		state: {
			selection: {},
			doc: { textBetween: vi.fn(() => "") },
		},
		chain: vi.fn(() => chain),
		can: vi.fn(() => ({
			setLink: vi.fn(() => true),
			setMark: vi.fn(() => true),
		})),
		on: vi.fn(),
		off: vi.fn(),
	} as unknown as Editor;

	return { editor, chain };
}

describe("LinkPopover", () => {
	it("renders nothing when no editor is provided", () => {
		const { container } = render(<LinkPopover editor={null} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders nothing when the link mark isn't in the editor schema", () => {
		const { editor } = createMockEditor({ hasLinkMark: false });
		const { container } = render(<LinkPopover editor={editor} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders nothing when the editor isn't editable", () => {
		const { editor } = createMockEditor({ isEditable: false });
		const { container } = render(<LinkPopover editor={editor} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders the link trigger when the editor accepts links", () => {
		const { editor } = createMockEditor();
		render(<LinkPopover editor={editor} />);
		expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
	});

	it("disables the trigger while the selection is inside a code block", () => {
		const { editor } = createMockEditor({
			isActive: (name) => name === "codeBlock",
		});
		render(<LinkPopover editor={editor} />);
		expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
	});

	it("applies a link and closes the popover", async () => {
		const user = userEvent.setup();
		const { editor, chain } = createMockEditor();

		render(<LinkPopover editor={editor} />);

		await user.click(screen.getByRole("button", { name: "Link" }));
		const urlInput = await screen.findByPlaceholderText("Paste a link...");
		await user.type(urlInput, "https://example.com");
		await user.click(screen.getByRole("button", { name: "Apply link" }));

		expect(chain.extendMarkRange).toHaveBeenCalledWith("link");
		expect(chain.insertContent).toHaveBeenCalledWith(
			expect.objectContaining({
				marks: [{ type: "link", attrs: { href: "https://example.com" } }],
			}),
		);
		expect(chain.run).toHaveBeenCalled();

		await waitFor(() =>
			expect(screen.queryByPlaceholderText("Paste a link...")).not.toBeInTheDocument(),
		);
	});

	it("removes an existing link", async () => {
		const user = userEvent.setup();
		const { editor, chain } = createMockEditor({
			isActive: (name) => name === "link",
			href: "https://example.com",
		});

		// The popover auto-opens because the selection already sits inside an active link.
		render(<LinkPopover editor={editor} />);

		await user.click(await screen.findByRole("button", { name: "Remove link" }));

		expect(chain.unsetMark).toHaveBeenCalledWith("link", { extendEmptyMarkRange: true });
		expect(chain.run).toHaveBeenCalled();
	});
});
