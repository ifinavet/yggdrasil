# 🌳 Yggdrasil Mono

Welcome to the yggdrasil monorepo! We are happy to have you here, and happy to help you start to contribute to you project, but first some information about the project.

## The project and the technology used 🛠️

The yggdrasil project is the underlying code powering the student association IFI-Navet at Institute of Infrormatiks at the University of Oslo. We work hard to give the students a best i class experience when attending company events and possably in the future others as well. The repositry contains the source code to our 2/3 core services and makes up the hart of you assiciation ifinavet.no. The services are as follows.

### 🌈  Bifrost

Bifrost is our administration service. It is here we create the events, populate the infromation and controll the registrations for the events. Bifrost is built on Next.js and uses typescript to try and mitigate runtime errors that javascript otherwise would create. We have used shadcn/ui to provide accsessable components without any major styling to create an hopefully intuitive and funtionall service.

### 🌍 Midgard

Midgard is what the users interact with and what we normally refer to as ifinavet.no. This is the core of our service and what makes the students able to atend our events. Midgard is also build on Next.js with typescript for the same reason. Midgard also heavlly uses shadcn/ui to give our users and functionall and accsessable experience but they are heavlly customized to fit with our design.

### 🗄️ Convex + Clerk

Convex is the backbone of the services. Convex at its core is just our database, but it provides a world class sync engine and allows us to have realtime funtionality that scales and is stable. Together with clerk it gives us authentication and authorazation to the diffrente ascpests and functions of our services.

## Projects structure 🏗️

The project uses turborepo to manage the different services and is structured like this:

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

That's great! We love any and all contributions, but sadly as we are students we does not have the ability nore the resources to deal with everything therefore we have some "rules" as to how to contribute.

1. Create an issue
   - We appreciate that if you are a new contributor that you first create an issue that we can review and approve before you potentially waste both our and your time implementing and testing something that is not an issue or othevise not to de done.
   - We try to asses each issue as fast as possible and an issue will be approved by ither the "webansvarlig-ifinavet" account or the personal account of the main maintainer (webansvarlig).
     - When assessing an issue we strive to approve as many as possible, but to approve you issue we focus on the impact of the issue raised, the size of the issue and the contribution history of the contributor. This is not to say that a first time contributor will automatically get an issue closed but we know that contributors who have contributed multiple times know the project and we need therfore not to asses their issues as cloasly.
2. Found an existing approved issue or got your issue approved?
   - Great! You can now go on to start contribute to the codebase. Before starting we would higly appreciate that you read the [CONTRIBUTING.md](CONTRIBUTING.md) as it describes how to contribute. After reading the contribution documentation you can go on to get setup. Since this project consists of multiple applications there are quite a few steps to get setup, but we are activly working to making it easier.
3. Get started and setup the project for local development.
   - Since not all issues require that all services run we have separate the "getting started" documentation into each serviec. Go to the service that you want to setup and read trough the README. For most issues the most common services that need to be setup are Convex and Midgard.
4. Finished with you contribution and want to merge?
   - Great work! Now its you are almost at the finishline. Create a PR with your contribution following the guidlines written it the [CONTRIBUTING.md](CONTRIBUTING.md) file and wait for the primary maintainer approve and merge your PR. If "webansvarlig-ifinavet" is not automatically selected to approve the PR you can do so manually also. If the account is not asked for approval the primary maintainer will not be notified and it will cause an delay to the merging.
   - Should you PR in an unfortunate event be declined you will be provided with a explanation as to what you need to change in order for it de be approved. Should you have any questions to the explanation feel free to just comment on the comment.
5. PR approved?
   - Congratulations! You are now an offical contributer to your little project. Give your self a pat on the back and feel free to start on a new issue if there are any.

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
