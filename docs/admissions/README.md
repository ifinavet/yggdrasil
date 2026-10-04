# Opptak: bilder og testdekning

Dette er et lokalt UI-utkast, ikke en ferdig produksjonsflyt. Bilder av manglende funksjonalitet blir ikke fremstilt som implementert funksjonalitet.

- [Bildeserie: student](student.md)
- [Bildeserie: styret](board.md)
- [Gjenstående integrasjoner og akseptansetester](integration-coverage.md)
- [Playwright-dekning](../../e2e/admissions/COVERAGE.md)
- [Sikkerhetsvurdering](security-review.md)

Bildene er tatt fra lokalt kjørende Hugin, Bifrost og eksisterende React Email-mal med syntetiske data. Playwright tester de implementerte UI-stegene; manglende backendflyter er eksplisitt registrert i dekningslisten.
## Run the preview checks

Follow the repository's [local development setup](../../README.md). Start Bifrost and Hugin with local authentication and a local Convex backend. The preview routes deliberately return 404 outside local mode.

```sh
pnpm exec playwright install chromium
pnpm test:e2e:admissions
```

The current worktree uses Bifrost `http://localhost:3021` and Hugin `http://localhost:3023`. For the standard development ports:

```sh
BIFROST_URL=http://localhost:3001 HUGIN_URL=http://localhost:3003 pnpm test:e2e:admissions
```

Only local HTTP origins are accepted by the runner. Tests start their own isolated browser contexts and do not start app servers. Enable `ADMISSIONS_SCREENSHOTS=1` to refresh the captured test states. The additional IAM screenshots are read-only views of the existing local organization page and React Email preview, not evidence of an admissions-to-IAM integration.

The Playwright command is separate from the existing CI `pnpm test` command until CI can start the required local applications and backend. Missing production journeys are documented in [the integration coverage matrix](integration-coverage.md); they are not empty skipped tests.
