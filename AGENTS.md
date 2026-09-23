# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Implementation conventions

- Check existing workspace packages and installed libraries before adding code. Use their supported APIs for solved problems rather than hand-rolled alternatives: Zod for validation, TanStack React Form for frontend form state, and date-fns with explicit timezone support for calendar calculations.
- Keep related code in feature folders, share reusable contracts and rules through workspace packages, and use bounded queries and batches as data grows. Prefer small, clear modules over speculative abstractions.
- Verify behavior through executable tests, including relevant edge cases and integration boundaries, before pushing changes.

## Copy conventions

User-facing Norwegian text, in both Hugin and Midgard, must never contain an em-dash (`—`). Use a comma, colon or full stop instead. En-dash (`–`) and hyphen (`-`) are unaffected, but only where they are correct.

Student-facing copy lives with the feature that owns it. For the Hugin event feedback form that is `apps/hugin/src/lib/event-feedback-questions.ts` (labels, hints, placeholders) and `packages/shared/feedback/schema.ts` (shared validation rules and messages), composed by `apps/hugin/src/lib/schema/event-feedback-schema.ts`; edit there rather than inline in components.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
