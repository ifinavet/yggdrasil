# 🌳 Yggdrasil Mono

Welcome to the Yggdrasil monorepo! We are happy to have you here and happy to help you start contributing to your project, but first, some information about the project.

## The project and the technology used 🛠️

The Yggdrasil project is the underlying code powering the student association IFI-Navet at the Institute of Informatics at the University of Oslo. We work hard to give students a best-in-class experience when attending company events and possibly, in the future, others as well. The repository contains the source code for our 2/3 core services and makes up the heart of your association, ifinavet.no. The services are as follows:

### 🌈 Bifrost

Bifrost is our administration service. It is where we create events, populate the information, and control the registrations for those events. Bifrost is built on Next.js and uses TypeScript to try and mitigate runtime errors that JavaScript otherwise would create. We have used shadcn/ui to provide accessible components without any major styling to create a hopefully intuitive and functional service.

### 🌍 Midgard

Midgard is what the users interact with and what we normally refer to as ifinavet.no. This is the core of our service and what enables students to attend our events. Midgard is also built on Next.js with TypeScript for the same reason. Midgard also heavily uses shadcn/ui to give our users a functional and accessible experience, but the components are heavily customized to fit our design.

### 🗄️ Convex + Clerk

Convex is the backbone of the services. Convex, at its core, is just our database, but it provides a world-class sync engine and allows us to have real-time functionality that scales and is stable. Together with Clerk, it gives us authentication and authorization for the different aspects and functions of our services.

## Project structure 🏗️

The project uses Turborepo to manage the different services and is structured like this:

```
🌳 yggdrasil/
├── 📁 apps/
│   ├── 🌈 bifrost/      # Admin dashboard and backend
│   └── 🌍 midgard/      # Main website for ifinavet.no
├── 📦 packages/
│   ├── 🗄️ backend/         # Convex backend logic
│   ├── 📧 emails /        # The react-emails components
│   ├── 🔧 typescript-config/ # Shared TypeScript configuration
│   └── 🎨 ui/           # Shared React component library
├── 📁 documentation/      # Documentation files
├── 📜 package.json      # Monorepo-level scripts and dependencies
└── ...
```

## Want to contribute? 🤝

That's great! We love any and all contributions, but sadly, as we are students, we do not have the ability nor the resources to deal with everything. Therefore, we have some "rules" on how to contribute.

1. **Create an issue**
   - We appreciate it if, as a new contributor, you first create an issue that we can review and approve before you potentially waste both our and your time implementing and testing something that is not an issue or otherwise not to be done.
   - We try to assess each issue as fast as possible, and an issue will be approved by either the "webansvarlig-ifinavet" account or the personal account of the main maintainer (webansvarlig).
     - When assessing an issue, we strive to approve as many as possible, but to approve your issue we focus on the impact of the raised issue, its size, and the contribution history of the contributor. This is not to say that a first-time contributor will automatically get an issue closed, but we know that contributors who have contributed multiple times know the project, and we therefore need not assess their issues as closely.
2. **Found an existing approved issue or got your issue approved?**
   - Great! You can now start contributing to the codebase. Before starting, we would highly appreciate it if you read the [`CONTRIBUTING.md`](CONTRIBUTING.md), as it describes how to contribute. After reading the contribution documentation, you can get set up. Since this project consists of multiple applications, there are quite a few steps to get everything ready, but we are actively working to make it easier.
3. **Get started and set up the project for local development.**
   - Since not all issues require all services to run, we have separated the “getting started” documentation for each service. Go to the service that you want to set up and read through its README. For most issues, the most common services that need to be set up are Convex and Midgard.
4. **Finished with your contribution and want to merge?**
   - Great work! You are almost at the finish line. Create a PR with your contribution following the guidelines written in the [`CONTRIBUTING.md`](CONTRIBUTING.md) file and wait for the primary maintainer to approve and merge your PR. If “webansvarlig-ifinavet” is not automatically selected to approve the PR, you can select it manually. If the account is not requested for approval, the primary maintainer will not be notified and it will cause a delay in merging.
   - Should your PR, in an unfortunate event, be declined, you will be provided with an explanation of what you need to change in order for it to be approved. Should you have any questions about the explanation, feel free to comment on the comment.
5. **PR approved?**
   - Congratulations! You are now an official contributor to your little project. Give yourself a pat on the back and feel free to start on a new issue if there are any.

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

This project is developed and maintained by the student association **IFI-Navet** at the University of Oslo, Department of Informatics.

Made with ❤️ by the IFI-Navet team.
