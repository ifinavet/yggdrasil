# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Copy conventions

User-facing Norwegian text, in both Hugin and Midgard, must never contain an em-dash (`—`). Use a comma, colon or full stop instead. En-dash (`–`) and hyphen (`-`) are unaffected, but only where they are correct.

Student-facing copy lives with the feature that owns it. For the Hugin event feedback form that is `apps/hugin/src/lib/event-feedback-questions.ts` (labels, hints, placeholders) and `apps/hugin/src/lib/schema/event-feedback-schema.ts` (validation messages); edit there rather than inline in components.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
