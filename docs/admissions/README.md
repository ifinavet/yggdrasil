# Opptak: testdekning

Opptakssiden bruker Convex for student- og styreflyten. Testene kjører mot en lokal, isolert backend med syntetiske kontoer. De verifiserer ikke levering fra eksterne Google-, Slack-, IAM- eller Resend-kontoer.

- [Integrasjonsdekning og gjenstående kontroller](integration-coverage.md)
- [Playwright-dekning](../../e2e/admissions/COVERAGE.md)
- [Sikkerhetsvurdering](security-review.md)

Kjør student- og styretestene med Playwright etter lokalt utviklingsoppsett i rotens README. Sett `ADMISSIONS_SCREENSHOTS=1` for å lagre skjermbilder lokalt i `test-results/admissions/screenshots/`. Disse filene ignoreres av Git.
