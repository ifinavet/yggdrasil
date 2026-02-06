# 🌈 Bifrost

Bifrost is the official admin dashboard and backend for [ifinavet.no](https://ifinavet.no). It serves as the central hub for managing content, events, job listings, and other administrative tasks for the student organization IFIs Navet.

## ✨ Features

-   **Content Management:** Easily create, edit, and delete resources and articles.
-   **Event Management:** Organize and manage all Navet events, including registrations.
-   **Job Listings:** A dedicated section for companies to post job opportunities for students.
-   **Company Database:** Keep track of partner companies and their information.
-   **Student Overview:** View and manage student members.

## Project Structure

```
.
├── src
│   ├── app
│   │   ├── (admin-pages)   # Admin-specific pages and layouts
│   │   ├── events          # Event-related pages
│   │   ├── job-listings    # Job listing pages
│   │   ├── profile         # User profile pages
│   │   └── resources       # Resource management pages
│   ├── components          # Reusable React components
│   ├── constants           # Schemas and constants
│   ├── hooks               # Custom React hooks
│   ├── lib                 # Core logic and zustand
│   └── utils               # Utility functions
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
    cd yggdrasil/apps/bifrost
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3. **Set up environment variables:**

   Create a `.env.local` file in the root of the `bifrost` directory and add the necessary environment variables. Look at the .env.example to get an idea of what you need.

   *Unfortunately our setup requires that you have an clerk account. Without it the auth won't work. We are assesing the options to move to a new solution but as of now you need to use clerk*

4.  **Run the development server:**

    ```bash
    pnpm dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
