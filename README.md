# Yggdrasil Monorepo

A modern, full-stack monorepo developed and maintained by the Student Association IFI-Navet at the University of Oslo, Department of Informatics.

---

## Project Overview

Yggdrasil is a modular, scalable monorepo designed to accelerate development of web applications and internal tools for IFI-Navet. It leverages modern frameworks, a shared UI library, and robust database tooling to ensure consistency, maintainability, and developer happiness across projects.

---

## Project Structure

```
yggdrasil/
├── apps/
│   ├── bifrost/      # Main Next.js application (full-stack)
│   └── midgard/      # Secondary Next.js application
├── packages/
│   ├── typescript-config/ # Shared TypeScript configuration
│   └── ui/           # Shared React component library
├── db/               # Database-related files (migrations, seeds, etc.)
├── package.json      # Monorepo-level scripts and dependencies
├── pnpm-workspace.yaml # Workspace configuration
└── ...
```

---

## Tech Stack & Key Packages

- **Monorepo Management:** [Turborepo](https://turbo.build/), [pnpm](https://pnpm.io/)
- **Frontend:** [Next.js](https://nextjs.org/) (React 19), [TypeScript](https://www.typescriptlang.org/)
- **UI Library:** [@workspace/ui](packages/ui) (React, Radix UI, Tailwind CSS, CVA, lucide-react)
- **Auth & Cloud:** [Clerk](https://clerk.com/), [Supabase](https://supabase.com/)
- **State & Forms:** [React Hook Form](https://react-hook-form.com/), [TanStack Query](https://tanstack.com/query)
- **Utilities:** [zod](https://zod.dev/), [date-fns](https://date-fns.org/), [clsx](https://github.com/lukeed/clsx)
- **Linting & Formatting:** [Biome](https://biomejs.dev/), [ESLint](https://eslint.org/), [Tailwind CSS](https://tailwindcss.com/)

---

## Getting Started

1. **Install dependencies:**
   ```sh
   pnpm install
   ```

2. **Run the main app (Bifrost):**
   ```sh
   pnpm dev --filter apps/bifrost
   # or, from the root:
   cd apps/bifrost
   pnpm dev
   ```

3. **Build all packages and apps:**
   ```sh
   pnpm build
   ```

4. **Lint and format code:**
   ```sh
   pnpm lint
   pnpm format-and-lint
   ```
---

## Contribution Guide

We welcome contributions from all IFI-Navet collaborators!

- **Branching:** Use feature branches and descriptive names.
- **Commits:** Write clear, conventional commit messages.
- **Linting:** Run `pnpm lint` and `pnpm format-and-lint` before pushing.
- **Type Safety & Accessibility:** Ensure all code is fully typed and UI components are accessible.
- **Documentation:** Document new features, components, or utilities.
- **Pull Requests:** Open a PR for review. All changes are subject to code review and CI checks.

---

## License

Private. For internal use within the IFI-Navet Yggdrasil monorepo only.

---

## Credits & Maintainers

Made with ❤️ by the IFI-Navet team
Department of Informatics, University of Oslo

For questions, suggestions, or to get involved, reach out to the IFI-Navet maintainers.

---
