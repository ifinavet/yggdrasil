# Opptak: bilder og testdekning

Opptakssiden bruker Convex for student- og styreflyten. Bilder med `live-` i filnavnet viser reelle UI-steg mot en lokal, isolert backend med syntetiske data. De dokumenterer ikke leveranser fra eksterne Google-, Slack-, IAM- eller Resend-kontoer. Andre nummererte bilder i bildemappene er eldre UI-eksempler.

- [Studentreisen](student.md)
- [Styrets opptaksflyt](board.md)
- [Integrasjonsdekning og gjenstående kontroller](integration-coverage.md)
- [Playwright-dekning](../../e2e/admissions/COVERAGE.md)
- [Sikkerhetsvurdering](security-review.md)

Kjør student- og styretestene med Playwright etter lokalt utviklingsoppsett i rotens README. Sett `ADMISSIONS_SCREENSHOTS=1` for å oppdatere bildene. Skjermbilder og tester bruker bare syntetiske kontoer.
