# 🌳 Yggdrasil Monorepo

A modern, full-stack monorepo developed and maintained by the Student Association IFI-Navet at the University of Oslo, Department of Informatics.

---

## 🚀 Project Overview

Yggdrasil is a modular, scalable monorepo designed to accelerate the development of web applications and internal tools for IFI-Navet. It leverages modern frameworks, a shared UI library, and robust database tooling to ensure consistency, maintainability, and developer happiness across projects. It is primarly focused on the devlopment of IFI-Navet's web site and backend tooling.

---

## 🏗️ Project Structure

```
🌳 yggdrasil/
├── 📁 apps/
│   ├── 🌈 bifrost/      # Admin dashboard and backend
│   └── 🌍 midgard/      # Main website for ifinavet.no
├── 📦 packages/
│   ├── ጀ backend/         # Convex backend logic
│   ├── 🔧 typescript-config/ # Shared TypeScript configuration
│   └── 🎨 ui/           # Shared React component library
├── 📁 documentation/      # Documentation files
├── 📜 package.json      # Monorepo-level scripts and dependencies
├── 📜 pnpm-workspace.yaml # Workspace configuration
└── ...
```

---

## 🛠️ Tech Stack & Key Packages

### Core Technologies

-   **Monorepo Management:** [Turborepo](https://turbo.build/) & [pnpm](https://pnpm.io/)
-   **Framework:** [Next.js](https://nextjs.org/) (React 19)
-   **Language:** [TypeScript](https://www.typescriptlang.org/)
-   **Styling:** [Tailwind CSS](https.tailwindcss.com/)

### UI & Frontend

-   **Component Library:** [@workspace/ui (based on Shadcn/ui)](packages/ui)
-   **UI Primitives:** [Radix UI](https://www.radix-ui.com/)
-   **Icons:** [Lucide React](https://lucide.dev/guide/packages/lucide-react)
-   **Class Merging:** [clsx](https://github.com/lukeed/clsx) & [tailwind-merge](https://github.com/dcastil/tailwind-merge)
-   **Animation:** [tw-animate-css](https://github.com/tuchfarber/tw-animate-css)

### State Management & Forms

-   **Data Fetching:** [TanStack Query](https://tanstack.com/query)
-   **Forms:** [React Hook Form](https://react-hook-form.com/)
-   **Schema Validation:** [Zod](https://zod.dev/)

### Backend & Database

-   **Authentication:** [Clerk](https://clerk.com/)
-   **Backend:** [Convex](https://www.convex.dev/)

### Tooling & DX

-   **Linting & Formatting:** [Biome](https://biomejs.dev/)
-   **Utilities:** [date-fns](https://date-fns.org/)

---

## 🏁 Getting Started

1.  **Install dependencies:**
    ```sh
    pnpm install
    ```

2.  **Run the main app (Bifrost):**
    ```sh
    turbo dev --filter=bifrost
    ```
    Alternatively, from the root of the `bifrost` app:
    ```sh
    cd apps/bifrost
    pnpm dev
    ```

3.  **Build all packages and apps:**
    ```sh
    turbo build
    ```

---

## 🤝 How to Contribute

We welcome contributions from all IFI-Navet collaborators! To ensure a smooth development process, please follow these guidelines:

-   **🌿 Branching:** Create a new feature branch for every new feature or bug fix (e.g., `feature/add-new-component` or `fix/login-bug`).
-   **✍️ Commits:** Write clear, concise, and conventional commit messages. This helps us understand the changes and automatically generate changelogs.
-   **🎨 Code Style:** Run `pnpm format-and-lint` before pushing to ensure your code adheres to our style guidelines.
-   **✅ Type Safety & Accessibility:** Ensure all code is fully typed and that UI components are accessible.
-   **📚 Documentation:** Document new features, components, or utilities to make them understandable for others.
-   **🚀 Pull Requests:** Open a Pull Request for review. All changes are subject to code review and CI checks.

---

## Reporting Bugs 🐛

If you find a bug, please let us know by creating an issue in the repository. We would love to check it out and find a solution. Provide as much detail as you can (the more the merrier), including steps to reproduce the bug, the expected behavior, and any relevant screenshots or logs.

## License 📄

This project is licensed under the GNU Affero General Public License. See the [`LICENSE`](LICENSE) file for more details.

## Contact 📧

For any inquiries, please contact us:

**E-mail**: <web@ifinavet.no>

**Website**: <https://ifinavet.no>

For questions, issues, or contributions:
- 🐛 Report bugs via GitHub issues
- 💡 Suggest features via GitHub discussions
- 📖 Check the documentation

---

This project is developed and maintained by the Student association **IFI-Navet** at the University of Oslo, Department of Informatics.

Made with ❤️ by the IFI-Navet team.
