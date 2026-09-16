# 🌈 Hugin

Hugin is Navet's event feedback service for [ifinavet.no](https://ifinavet.no). It lets event participants share feedback with the organizers after attending an event.

## ✨ Features

-   **Event Feedback:** Participants give feedback on the events they attended.
-   **Organizer Insights:** Organizers see aggregated feedback for their events.

## Project Structure

```
.
├── src
│   ├── app
│   │   └── event-feedback   # Feedback pages and response handling
│   ├── components           # Reusable React components
│   ├── lib                  # Core logic and helpers
│   └── providers            # Application providers
└── ...
```

## 🚀 Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v20 or later)
-   [pnpm](https://pnpm.io/)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/ifinavet/yggdrasil.git
    cd yggdrasil/apps/hugin
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3. **Set up environment variables:**

   No environment variables are needed for local development; the app falls back to local mode with mocked authentication. See the [repository README](../../README.md) for details.

   To use real services (Clerk, PostHog, a hosted Convex deployment), copy the variables from `.env.example` into a `.env.local` file in this directory and set `APP_ENV=production`.

4.  **Run the development server:**

    ```bash
    pnpm dev
    ```

    Open [http://localhost:3003](http://localhost:3003) with your browser to see the result.

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
