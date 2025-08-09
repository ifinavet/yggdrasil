# 🌍 Midgard

Midgard is the official website for [ifinavet.no](https://ifinavet.no), the student association for the Department of Informatics at the University of Oslo. It serves as the main point of contact for students, companies, and the public.

## ✨ Features

-   **Event Calendar:** A full overview of all events organized by IFI-Navet.
-   **Job Listings:** A dedicated section for companies to post job opportunities for students.
-   **Company Profiles:** Information about IFI-Navet's partner companies.
-   **Student Resources:** A collection of useful resources for students at the Department of Informatics.

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v20 or later)
-   [pnpm](https://pnpm.io/)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-repo/yggdrasil.git
    cd yggdrasil/apps/midgard
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**

    Create a `.env.local` file in the root of the `midgard` directory and add the necessary environment variables. You can get these from a project administrator.

4.  **Run the development server:**

    ```bash
    pnpm dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Technologies & Packages

Midgard is built with a modern tech stack, including:

-   **[Next.js](https://nextjs.org/):** The React framework for production.
-   **[React](https://react.dev/):** A JavaScript library for building user interfaces.
-   **[TypeScript](https://www.typescriptlang.org/):** A typed superset of JavaScript.
-   **[Convex](https://www.convex.dev/):** The backend for the application.
-   **[Clerk](https://clerk.com/):** User management and authentication.
-   **[Tailwind CSS](https://tailwindcss.com/):** A utility-first CSS framework.
-   **[@workspace/ui](https://github.com/your-repo/yggdrasil/tree/main/packages/ui):** The shared component library.

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
