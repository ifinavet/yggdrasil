# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Implementation conventions

- Check existing workspace packages and installed libraries before adding code. Use their supported APIs for solved problems rather than hand-rolled alternatives: Zod for validation, TanStack React Form for frontend form state, and date-fns with explicit timezone support for calendar calculations.
- Keep related code in feature folders, share reusable contracts and rules through workspace packages, and use bounded queries and batches as data grows. Prefer small, clear modules over speculative abstractions.
- Verify behavior through executable tests, including relevant edge cases and integration boundaries, before pushing changes.

## Dependency updates

External dependencies used by multiple workspace packages share exact versions in the catalog in `pnpm-workspace.yaml`. Use `"catalog:"` in their dependency and peer declarations; update the catalog and regenerate `pnpm-lock.yaml` together. React overrides also reference the catalog. `pnpm check-dependencies` rejects independent shared declarations or different installed versions and runs before type-checking in CI. Dependabot supports catalogs; keep coupled React, Tiptap and Vitest updates grouped for both version and security updates.

## Copy conventions

User-facing Norwegian text, in both Hugin and Midgard, must never contain an em-dash (`—`). Use a comma, colon or full stop instead. En-dash (`–`) and hyphen (`-`) are unaffected, but only where they are correct.

Student-facing copy lives with the feature that owns it. For the Hugin event feedback form that is `apps/hugin/src/lib/event-feedback-questions.ts` (labels, hints, placeholders) and `packages/shared/feedback/validation.ts` (shared validation rules and messages), composed by `apps/hugin/src/lib/schema/event-feedback-schema.ts`; edit there rather than inline in components.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
