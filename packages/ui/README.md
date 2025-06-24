# @workspace/ui

A modern, reusable React component library for the Yggdrasil monorepo. This package delivers accessible, themeable, and composable UI building blocks to accelerate development and ensure design consistency across all Yggdrasil projects.

---

## Project Overview

`@workspace/ui` is the shared UI foundation for the Yggdrasil monorepo, providing a suite of customizable components and utilities. It is designed for rapid development, accessibility, and seamless theming, empowering teams to build high-quality interfaces efficiently.

---

## Project Structure

```
packages/ui/
├── components/      # Reusable React components
├── lib/             # Utility functions (e.g., cn)
├── globals.css      # Global styles and CSS variables
├── index.ts         # Entry point for exports
└── ...
```

---

## Technology Stack

- **React 19** — Modern component architecture
- **TypeScript** — Type safety and great developer experience
- **Radix UI Primitives** — Accessibility and composability
- **Tailwind CSS** — Utility-first styling and theming
- **class-variance-authority (CVA)** — Variant management for components
- **lucide-react** — Icon library

---

## Installation

This package is intended for internal use within the Yggdrasil monorepo.

```sh
pnpm add @workspace/ui
# or
yarn add @workspace/ui
# or
npm install @workspace/ui
```

---

## Usage

Import components and utilities as needed:

```tsx
import { Button, Card, Input } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
```

Import global styles (if not already included):

```css
@import "@workspace/ui/globals.css";
```

---

## Available Components

- AlertDialog, Avatar, Badge, Breadcrumb, Button, Calendar, Card, Command, Dialog, DropdownMenu, Form, Input, Label, Popover, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Sonner (Toaster), Table, Tabs, Textarea, Tooltip

All components are accessible, themeable, and composable. For detailed usage and props, refer to the source files.

---

## Theming

- Built with Tailwind CSS and CSS variables for easy customization.
- Supports dark mode via the `.dark` class.
- Override CSS variables in your app for custom themes.

Example:

```css
:root {
  --primary: oklch(0.21 0.006 285.885);
  --background: oklch(1 0 0);
  /* ... */
}
```

---

## Contribution Guide

We welcome contributions from all Yggdrasil monorepo collaborators!

1. **Follow monorepo conventions** for branching, commit messages, and PRs.
2. **Lint before you commit:**
   ```sh
   pnpm lint
   ```
3. **Accessibility and Type Safety:**
   Ensure all components are accessible and fully typed.
4. **Documentation:**
   Document new components/utilities with usage examples in the source or a relevant MDX file.
5. **Pull Requests:**
   Open a PR for review. All changes are subject to code review and CI checks.

---

## License

Private. For internal use within the Yggdrasil monorepo only.

---

_Made with ❤️ by the IFI-Navet team at the University of Oslo, Department of Informatics._
