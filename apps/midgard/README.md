# 🌍 Midgard

Midgard is the official website for [ifinavet.no](https://ifinavet.no), the student association for the Department of Informatics at the University of Oslo. It serves as the main point of contact for students, companies, and the public.

## ✨ Features

-   **Event Calendar:** A full overview of all events organized by IFI-Navet.
-   **Job Listings:** A dedicated section for companies to post job opportunities for students.
-   **Company Profiles:** Information about IFI-Navet's partner companies.
-   **Student Resources:** A collection of useful resources for students at the Department of Informatics.

## Project Structure

```
.
├── src
│   ├── app
│   │   ├── (auth)   				# Sign-in and registration pages
│   │   ├── (home)   				# Home page
│   │   ├── companies       # Information about IFI-Navet for companies.
│   │   ├── students        # Information about IFI-Navet for students.
│   │   ├── contact         # Contact Page
│   │   ├── job-listings    # Job listing pages
│   │   ├── profile         # User profile pages
│   │   ├── events          # Event pages
│   │   ├── info            # Event details pages
│   │   └── organization    # Information about IFI-Navet's organization.
│   ├── components          # Reusable React components
│   ├── constants           # constants
│   ├── provider            # Application providers
│   ├── utils               # Utility functions
└── ...
```

## 🚀 Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v20 or later)
-   [pnpm](https://pnpm.io/)

### Installation

Run the monorepo setup from the repository root. It configures every service at once, without any third-party accounts:

```bash
git clone https://github.com/ifinavet/yggdrasil.git
cd yggdrasil
pnpm install
pnpm setup:local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in as one of the seeded development users. See the [root README](../../README.md) for the full walkthrough, including how to work against real Clerk keys instead.

## 🛠️ Technologies & Packages

Bifrost is built with a modern tech stack, including:

-   **[Next.js](https://nextjs.org/):** The React framework for production.
-   **[React](https://react.dev/):** A JavaScript library for building user interfaces.
-   **[TypeScript](https://www.typescriptlang.org/):** A typed superset of JavaScript.
-   **[Convex](https://www.convex.dev/):** The backend for the application.
-   **[Clerk](https://clerk.com/):** User management and authentication.
-   **[Tailwind CSS](https://tailwindcss.com/):** A utility-first CSS framework.
-   **[Shadcn/ui](https://ui.shadcn.com/):** Re-usable components built using Radix UI and Tailwind CSS.
-   **[Tiptap](https://tiptap.dev/):** A headless wrapper around ProseMirror for building rich text editors.
-   **[Zod](https://zod.dev/):** A TypeScript-first schema declaration and validation library.

## 🙌 Contributing

Read the [README.md](/README.md) at the root of the project.
