# Navet - Project Unagi 🌉

**Bindeledd mellom studenter og næringslivet for studentene på institutt for informatikk ved UiO**

A modern web application built with Next.js and Supabase that connects computer science students at the University of Oslo with industry opportunities. The project uses Norse mythology naming conventions, with Yggdrasil as the world tree that connects all realms.

> [!WARNING]
> This project is under active development and not yet in production. We aim for a stable release in the near future.
> If you want to contribute please contact Webansvarlig at IFI-Navet via email at <web@ifinavet.no>.

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#development"><strong>Development</strong></a> ·
  <a href="#project-structure"><strong>Project Structure</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>

### Environment Variables

Required for production:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

## Features

### 🚀 **Core Stack**

- **Next.js 15** with App Router and React 19
- **Clerk** for authentication and user management
- **Supabase** for database with Clerk integration
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **shadcn/ui** components

### 🎨 **UI/UX**

- Modern, responsive design
- Dark/light theme support with `next-themes`
- Accessible components with Radix UI
- Lucide React icons

### 🔐 **Authentication**

- **Clerk** for complete authentication solution
- Secure session management across all Next.js features
- Sign up, sign in, and user management flows
- Protected routes with middleware
- Integration with Supabase using Clerk tokens

### 📱 **Realms (App Sections)**

- **Midgard** - Main application area with protected routes
- **Bifrost** - Bridge/connection features and admin tools

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Clerk account

### 1. Clone and Install

```bash
git clone <repository-url>
cd yggdrasil
pnpm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

Get Supabase values from your [Supabase project dashboard](https://app.supabase.com/project/_/settings/api).
Get Clerk values from your [Clerk dashboard](https://dashboard.clerk.com/).

### 3. Start Development

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application.

## Development

### Available Scripts

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm start                  # Start production server

# Code Quality
pnpm lint                   # Run Next.js linting
```

### Development Workflow

1. **Feature Development**: Work in feature branches
2. **Code Quality**: Use Next.js built-in linting
3. **Type Safety**: Leverage TypeScript and Supabase types
4. **Authentication**: Utilize Clerk for user management
5. **UI Components**: Use shadcn/ui and maintain design consistency

## Project Structure

```
Yggdrasil/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (bifrost)/          # Bridge/connection features & admin tools
│   │   ├── (midgard)/          # Main application
│   │   │   ├── (protected)/    # Protected routes requiring authentication
│   │   │   └── login/          # Login page
│   │   └── api/                # API routes
│   ├── components/             # Reusable UI components
│   │   └── ui/                 # shadcn/ui components
│   ├── utils/                  # Utility functions
│   │   └── supabase/          # Supabase client configuration with Clerk
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Core libraries and configurations
│   └── assets/                 # Static assets
├── middleware.ts               # Clerk middleware for route protection
└── db/                         # Database related files
```

### Key Concepts

#### Authentication Flow

- **Clerk Integration**: Complete authentication solution with Supabase database
- **Protected Routes**: Middleware-based route protection
- **Token Integration**: Clerk tokens used for Supabase RLS

#### Route Groups

- `(bifrost)` - Bridge/connection functionality and admin tools
- `(midgard)` - Main application content
  - `(protected)` - Routes requiring authentication
  - `login` - Authentication entry point

#### Component Organization

- **UI Components**: Located in `components/ui/` (shadcn/ui)
- **Feature Components**: Organized by feature/realm
- **Shared Components**: Root-level components for common use

## Technology Stack

| Category            | Technology                 |
| ------------------- | -------------------------- |
| **Framework**       | Next.js 15 with App Router |
| **Language**        | TypeScript                 |
| **Styling**         | Tailwind CSS v4            |
| **Components**      | shadcn/ui + Radix UI       |
| **Database**        | Supabase                   |
| **Authentication**  | Clerk                      |
| **Icons**           | Lucide React               |
| **Themes**          | next-themes                |
| **Notifications**   | Sonner                     |
| **Package Manager** | pnpm                       |

## Contributing 🤝

We'd love your help to make this project even better! To contribute, use github flow and please follow these steps:

1. **Clone** the repository
2. **Create** a new branch (`git checkout -b feature-branch`)
3. **Make** your changes
4. **Test** your changes thoroughly
5. **Commit** your changes (`git commit -m 'Add new feature'`)
6. **Push** to the branch (`git push origin feature-branch`)
7. **Open** a pull request

Please make sure your code follows our coding standards.

### Code Standards

- Use TypeScript for type safety
- Follow the existing code style
- Use semantic commit messages
- Update documentation as needed
- Provide detailed descriptions in pull requests

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
