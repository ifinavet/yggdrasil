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
  <a href="#testing"><strong>Testing</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>

### Environment Variables

Required for production:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Features

### 🚀 **Core Stack**
- **Next.js 15** with App Router and React 19
- **Supabase** for authentication and database
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** components

### 🎨 **UI/UX**
- Modern, responsive design
- Dark/light theme support with `next-themes`
- Toast notifications with `sonner`
- Rich text editing with TipTap
- Accessible components with Radix UI

### 🔐 **Authentication**
- Cookie-based authentication with `@supabase/ssr`
- Secure session management across all Next.js features
- Sign up, sign in, and password reset flows
- Protected routes and middleware

### 🧪 **Testing**
- **Unit tests** with Jest and React Testing Library
- **Integration tests** for API routes and database operations
- **End-to-end tests** with Playwright
- **Database tests** for Supabase interactions
- Comprehensive test coverage reporting

### 📱 **Realms (App Sections)**
- **Midgard** - Main application area
- **Bifrost** - Bridge/connection features
- **Auth Pages** - Authentication flows

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn
- Supabase account

### 1. Clone and Install

```bash
git clone <repository-url>
cd Yggdrasil
pnpm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these values from your [Supabase project dashboard](https://app.supabase.com/project/_/settings/api).

### 4. Start Development

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

# Testing
pnpm test                   # Run unit tests
pnpm test:e2e               # Run end-to-end tests
pnpm test:all               # Run all tests

# Code Quality
npx biome check --apply     # Lint and format
```

### Development Workflow

1. **Feature Development**: Work in feature branches
2. **Code Quality**: Use Biome for linting and formatting
3. **Testing**: Write tests for new features
4. **Type Safety**: Leverage TypeScript and Supabase types
5. **UI Components**: Use shadcn/ui and maintain design consistency

## Project Structure

```
Yggdrasil/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth-pages)/       # Sign in, sign up, forgot password
│   │   ├── (bifrost)/          # Bridge/connection features
│   │   └── (midgard)/          # Main application (events, protected pages)
│   ├── components/             # Reusable UI components
│   │   └── ui/                 # shadcn/ui components
│   ├── supabase/               # Database configuration
│   ├── lib/                    # Utility libraries
│   └── hooks/                  # Custom React hooks
├── __tests__/                  # All test files
└── playwright-tests/           # End-to-end tests
```

### Key Concepts

#### Route Groups
- `(auth-pages)` - Authentication-related pages
- `(bifrost)` - Bridge/connection functionality
- `(midgard)` - Main application content

#### Component Organization
- **UI Components**: Located in `components/ui/` (shadcn/ui)
- **Feature Components**: Organized by feature/realm
- **Shared Components**: Root-level components for common use

#### Testing Strategy
- **Unit Tests**: Individual component and function testing
- **Integration Tests**: Feature-level testing with mocked dependencies
- **Database Tests**: Supabase interaction testing
- **E2E Tests**: Full user flow testing with Playwright

## Testing

### Running Tests

```bash
# Quick test run
pnpm test

# Watch mode for development
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific test types
pnpm test:unit
pnpm test:integration
pnpm test:db
pnpm test:e2e
```

### Test Structure

```
__tests__/
├── unit/                    # Component and utility tests
├── integration/             # Feature integration tests
├── database/                # Supabase/database tests
├── helpers/                 # Test helper functions
├── mocks/                   # Mock implementations
└── utils/                   # Test utilities
```

### Writing Tests

1. **Unit Tests**: Test individual components and functions
2. **Integration Tests**: Test feature workflows
3. **Database Tests**: Test Supabase operations
4. **E2E Tests**: Test complete user journeys

### Environment Variables

Required for production:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Contributing 🤝

We'd love your help to make this project even better! To contribute, please follow these steps:

1. **Clone** the repository
2. **Create** a new branch (`git checkout -b feature-branch`)
3. **Make** your changes
4. **Write** tests for your changes
5. **Commit** your changes (`git commit -m 'Add new feature'`)
6. **Push** to the branch (`git push origin feature-branch`)
7. **Open** a pull request

Please make sure your code follows our coding standards and includes appropriate tests.

### Code Standards

- Use TypeScript for type safety
- Follow the existing code style (Biome)
- Write tests for new features
- Use semantic commit messages
- Update documentation as needed
- Provide as much detail as possible in pull requests

## Technology Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 15 with App Router |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Components** | shadcn/ui + Radix UI |
| **Database** | Supabase |
| **Authentication** | Supabase Auth |
| **Testing** | Jest, RTL, Playwright |
| **Code Quality** | Biome |
| **Package Manager** | pnpm |

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
