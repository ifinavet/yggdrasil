# 🌈 Bifrost

Bifrost is the official admin dashboard and backend for [ifinavet.no](https://ifinavet.no). It serves as the central hub for managing content, events, job listings, and other administrative tasks for the student organization IFIs Navet.

## ✨ Features

-   **Content Management:** Easily create, edit, and delete resources and articles.
-   **Event Management:** Organize and manage all Navet events, including registrations.
-   **Job Listings:** A dedicated section for companies to post job opportunities for students.
-   **Company Database:** Keep track of partner companies and their information.
-   **Student Overview:** View and manage student members.

## Project Structure

The Bifrost application is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

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
│   ├── lib                 # Core logic, queries, and Supabase client
│   └── utils               # Utility functions
├── supabase                # Supabase migrations and configuration
└── ...
```

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v20 or later)
-   [pnpm](https://pnpm.io/)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-repo/yggdrasil.git
    cd yggdrasil/apps/bifrost
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**

    Create a `.env.local` file in the root of the `bifrost` directory and add the necessary environment variables. You can get these from a project administrator.

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
-   **[Supabase](https://supabase.com/):** The open-source Firebase alternative for the database and authentication.
-   **[Clerk](https://clerk.com/):** User management and authentication.
-   **[Tailwind CSS](https://tailwindcss.com/):** A utility-first CSS framework.
-   **[Shadcn/ui](https://ui.shadcn.com/):** Re-usable components built using Radix UI and Tailwind CSS.
-   **[TanStack Query](https://tanstack.com/query/latest):** A powerful data-fetching and state management library.
-   **[Tiptap](https://tiptap.dev/):** A headless wrapper around ProseMirror for building rich text editors.
-   **[Zod](https://zod.dev/):** A TypeScript-first schema declaration and validation library.

## 🙌 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

This project is maintained by both novice and experienced developers, mostly students. We encourage a collaborative and supportive environment.

### How to Contribute

1.  **Fork the Project:** Click the 'Fork' button at the top right of the page.
2.  **Create your Feature Branch:** `git checkout -b feature/AmazingFeature`
3.  **Commit your Changes:** `git commit -m 'Add some AmazingFeature'`
4.  **Push to the Branch:** `git push origin feature/AmazingFeature`
5.  **Open a Pull Request:** Go to the repository on GitHub and click 'New pull request'.

Please make sure your code adheres to the project's coding standards and that you have tested your changes thoroughly.

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
