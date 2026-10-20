import { EVENT_EXPENSE_TEMPLATE_URL } from "@workspace/shared/constants";
import type { WikiArticle } from "@workspace/shared/wiki";

function guide(
	input: Omit<WikiArticle, "aliases" | "facts"> & Partial<Pick<WikiArticle, "aliases" | "facts">>,
): WikiArticle {
	return { aliases: [], facts: [], ...input };
}
const wiki = (slug: string, label: string) => `<a href="/wiki/${slug}">${label}</a>`;
const app = (path: string, label: string) => `<a href="${path}">${label}</a>`;

export const HANDBOOK_ARTICLES: WikiArticle[] = [
	guide({
		slug: "finn-frem",
		title: "Navets systemer",
		category: "start",
		excerpt: "Hva Bifrost, Midgard, Hugin, Slack, Google Workspace og Fiken brukes til.",
		aliases: ["Bifrost", "Hugin", "Midgard", "kom i gang"],
		content: `<ul>
<li><p><strong>Bifrost:</strong> arrangementer, bedriftssamarbeid, opptak, medlemskontoer og fakturaoppfølging.</p></li>
<li><p><strong>Midgard (ifinavet.no):</strong> den offentlige nettsiden med arrangementer, studentpåmelding, studentprofil og stillingsannonser.</p></li>
<li><p><strong>Hugin:</strong> tilbakemeldinger etter arrangementer, bestilling av bedpress og annonser, planlegging med bedrifter og søknad om opptak i Navet.</p></li>
<li><p><strong>Slack:</strong> bedriftskanaler og påminnelser fra Navet-botten.</p></li>
<li><p><strong>Google Workspace:</strong> Navet-konto, epost, Google Drive og kalender.</p></li>
<li><p><strong>Fiken:</strong> oppretting og utsending av fakturaer.</p></li>
</ul>`,
	}),
	guide({
		slug: "holde-bedpress",
		title: "Holde bedpress",
		category: "events",
		excerpt: "Planlegging, gjennomføring og etterarbeid.",
		aliases: ["bedpres", "bedriftspresentasjon", "hvordan holde bedpress", "utlegg", "kvittering"],
		content: `<ol>
<li><p>${wiki("planlegge-med-bedriften", "Send planleggingslenken til bedriften")} og se ${wiki("bedriftshistorikk", "tidligere samarbeid")}. Én gratis stand er inkludert.</p></li>
<li><p>${wiki("publisere-arrangement", "Oppdater og publiser arrangementet")}.</p></li>
<li><p>Organiseringsansvarlig bestiller rom, restaurant og mat. Bekreft bestillingene og medhjelperne i ${wiki("sjekkliste", "arrangementets sjekkliste")}. Alkohol kan serveres på Escape eller i bedriftens lokaler, ikke i klasserom.</p></li>
<li><p>Avklar promotering med PR-ansvarlig. Maks to innlegg per arrangement i Facebook-gruppen Ifi-studenter.</p></li>
<li><p>${wiki("paminnelse-epost", "Godkjenn påminnelseseposten")} med praktisk informasjon til deltakerne.</p></li>
<li><p>Ta med PC til ${wiki("oppmote-prikker", "oppmøteføringen")}, vann og kaffe til bedriften. Påmelding stenger når arrangementet starter.</p></li>
<li><p>Følg ${wiki("tilbakemeldinger", "tilbakemeldingene")} og ${wiki("bedriftsrapport", "godkjenn og send bedriftsrapporten")}.</p></li>
<li><p>Se ${app(EVENT_EXPENSE_TEMPLATE_URL, "utlegg for personlige kjøp og Navet-kortet")}.</p></li>
</ol>`,
	}),
	guide({
		slug: "bedriftssoknader",
		title: "Behandle bedriftssøknader",
		category: "companies",
		excerpt: "Epostbekreftelse, søknadsperiode og ønsker fra bedriften.",
		aliases: ["bestille bedpres", "bestilling", "bedpress bestilling", "søknad", "Google Sheets"],
		content: `<p>En søknad vises først etter at bedriften har bekreftet epostadressen sin. Hvis en søknad mangler, be kontaktpersonen sjekke bekreftelseseposten.</p>
<ol>
<li><p>Åpne ${app("/semesterplan", "Semesterplan")} og velg semester. Sett søknadsperiode og tilbudene bedriftene kan velge.</p></li>
<li><p>Les ønskene, kontaktinformasjonen og fakturadetaljene i søknadene før du ${wiki("semesterplan", "fordeler datoer og sender tilbud")}.</p></li>
<li><p>Tilpass semesterets bekreftelsesepost ved behov. <code>{bedrift}</code> erstattes med bedriftsnavnet.</p></li>
</ol>
<p>En søknad kan ikke slettes permanent hvis fakturaen har vært sendt. Følg opp endringer under ${wiki("fakturering", "Fakturaer")}.</p>`,
	}),
	guide({
		slug: "semesterplan",
		title: "Planlegge semester og sende tilbud",
		category: "companies",
		excerpt: "Fordel datoer og produkter, send tilbud og følg bedriftens svar.",
		aliases: ["semesterplanlegging", "tilbud", "datoer"],
		content: `<ol>
<li><p>Velg semester i ${app("/semesterplan", "Semesterplan")} og legg inn arrangementsdatoene.</p></li>
<li><p>Fordel datoer og produkter ut fra bedriftenes søknader. Kontroller pris, kapasitet og kontaktperson før tilbudet sendes.</p></li>
<li><p>Send tilbudet og følg bedriftens svar i oversikten.</p></li>
<li><p>Åpne det tilknyttede arrangementet i ${app("/events", "Arrangementer")} og velg hovedansvarlig og medhjelpere.</p></li>
</ol>`,
	}),
	guide({
		slug: "planlegge-med-bedriften",
		title: "Planlegge med bedriften",
		category: "companies",
		excerpt: "Send planleggingslenken, avklar ønskene og godkjenn opplegget.",
		aliases: ["førstegangskontakt", "planleggingsskjema", "kontaktperson"],
		content: `<ol>
<li><p>Åpne arrangementet og se ${wiki("bedriftshistorikk", "tidligere samarbeid")} med bedriften.</p></li>
<li><p>Se gjennom planleggingsinvitasjonen, kontaktadressen og signaturen. Send lenken til bedriften.</p></li>
<li><p>Les bedriftens forslag til tekst, format, sted, mat og kapasitet.</p></li>
<li><p>Godkjenn svaret og ${wiki("publisere-arrangement", "publiser arrangementet")} når teksten er klar.</p></li>
</ol>
<p>Planleggingsskjemaet gjør ingen bestillinger av rom, restaurant eller mat.</p>`,
	}),
	guide({
		slug: "annonsebestilling",
		title: "Behandle annonsebestillinger",
		category: "companies",
		excerpt: "Godkjenn eller avvis stillingsannonser og følg opp fakturagrunnlaget.",
		aliases: ["annonse ordering", "jobbannonse", "stillingsannonse", "EHF"],
		content: `<ol>
<li><p>Åpne bestillingen under ${app("/job-listings", "Stillingsannonser")}.</p></li>
<li><p>Se gjennom annonsetekst, søknadsfrist, produkt og kontaktperson. Kontroller organisasjonsnummer og fakturaadresse eller EHF.</p></li>
<li><p>Godkjenn bestillingen for å publisere annonsen og varsle bedriften. Ved avvisning oppgir du begrunnelsen til bedriften.</p></li>
<li><p>Følg opp faktureringen under ${wiki("fakturering", "Fakturaer")}.</p></li>
</ol>
<p>Du kan også opprette annonser manuelt fra oversikten. Sjekk først at bedriften ikke allerede har sendt en bestilling.</p>`,
	}),
	guide({
		slug: "bedriftshistorikk",
		title: "Finne bedriftshistorikk",
		category: "companies",
		excerpt: "Tidligere arrangementer, stillingsannonser og rapporter for en bedrift.",
		aliases: ["CRM", "tidslinje", "bedriftssøk"],
		content: `<p>Søk opp bedriften under ${app("/companies", "Bedrifter")}. Tidslinjen viser tidligere arrangementer og stillingsannonser. Åpne et arrangement for å lese tilbakemeldinger og rapport.</p>
<p>Hvis et samarbeid mangler, sjekk at arrangementet eller annonsen er koblet til bedriften.</p>`,
	}),
	guide({
		slug: "publisere-arrangement",
		title: "Opprette og publisere arrangementer",
		category: "events",
		excerpt: "Tekst, kapasitet, ansvarlige og påmeldingstider.",
		aliases: ["ny bedpres", "publisering", "eksternt arrangement"],
		content: `<ol>
<li><p>Åpne ${app("/events", "Arrangementer")}. Bruk arrangementet fra semesterplanen hvis det allerede finnes.</p></li>
<li><p>Fyll ut tittel, introduksjon og beskrivelse. Sett dato, sted, kapasitet, påmeldingsåpning og avmeldingsfrist.</p></li>
<li><p>Velg hovedansvarlig og medhjelpere. Registrer servering og velg ${wiki("lage-skjema", "tilbakemeldingsskjema")}.</p></li>
<li><p>Publiser og åpne den offentlige siden for å kontrollere tekst og påmeldingstider.</p></li>
</ol>
<p>For eksterne arrangementer kan påmeldingen gå via en ekstern lenke.</p>`,
	}),
	guide({
		slug: "sjekkliste",
		title: "Arrangementets sjekkliste",
		category: "events",
		excerpt: "Oppgavene før, under og etter arrangementet.",
		aliases: ["sjekkliste", "medhjelper", "promotering"],
		content: `<p>Åpne arrangementet under ${app("/events", "Arrangementer")} og kryss av utførte oppgaver.</p>`,
		facts: ["checklist"],
	}),
	guide({
		slug: "pameldinger-venteliste",
		title: "Påmeldinger og venteliste",
		category: "events",
		excerpt: "Forskjellen på bekreftet plass, venteliste og tilbud om plass.",
		aliases: ["venteliste", "påmeldinger", "tilbud om plass", "avmelding"],
		content: `<p>Deltakerlisten på arrangementet viser hvem som har plass, står på venteliste eller har fått tilbud om plass.</p>
<p>Når en plass blir ledig, sender systemet tilbud til ventelisten. Studenten må svare innen fristen i tilbudet. Et ubesvart tilbud er ikke en bekreftet plass.</p>
<p>Ved spørsmål om en plass: sjekk studentens status i deltakerlisten. Studenten ser tilbudsfristen på ifinavet.no. Hvis studenten ikke får meldt seg på, se ${wiki("studenthjelp", "hjelp med påmelding")}.</p>`,
	}),
	guide({
		slug: "oppmote-prikker",
		title: "Registrere oppmøte og rette prikker",
		category: "events",
		excerpt: "Registrer oppmøte med QR eller deltakerlisten. Rett feil på samme påmelding.",
		aliases: ["prikkesystem", "prikksystem", "QR", "fravær", "møtt sent", "ikke møtt"],
		content: `<ol>
<li><p>Åpne arrangementets deltakerliste. Skann studentens QR-kode eller søk på navn.</p></li>
<li><p>Velg <strong>Oppmøtt</strong>, <strong>Møtt sent</strong> eller <strong>Ikke møtt</strong> på påmeldingen. Ved mer enn 15 minutters forsinkelse registreres deltakeren normalt som <strong>Ikke møtt</strong>.</p></li>
<li><p>Rett feil ved å endre oppmøtestatusen på samme påmelding. Prikkene fra påmeldingen erstattes; andre prikker beholdes.</p></li>
</ol>
<p>Under ${app("/students", "Studenter")} ser du studentens øvrige prikker, begrunnelser og påmeldingssperre.</p>`,
		facts: ["attendance"],
	}),
	guide({
		slug: "paminnelse-epost",
		title: "Sende påminnelsesepost",
		category: "events",
		excerpt: "Se gjennom praktisk informasjon og godkjenn utsendingen til studentene.",
		aliases: ["reminder", "påminnelse", "epost", "BCC", "blindkopi"],
		content: `<ol>
<li><p>Åpne påminnelsen på arrangementet. Legg til praktisk informasjon om sted, utstyr og forberedelser.</p></li>
<li><p>Se gjennom forhåndsvisningen og antall mottakere.</p></li>
<li><p>Godkjenn sendingen. Systemet starter utsendingen.</p></li>
<li><p>Kontroller utsendingsstatusen på arrangementet. Statusen viser om utsendingen har startet, ikke om alle epostene er levert.</p></li>
</ol>
<p>Slack minner deg om å godkjenne teksten. Det betyr ikke at studenteposten er sendt.</p>`,
	}),
	guide({
		slug: "tilbakemeldinger",
		title: "Automatiske tilbakemeldinger",
		category: "events",
		excerpt: "Hvem som får skjemaet, når det sendes og hvor du finner svarene.",
		aliases: ["feedback", "evaluering", "spørreundersøkelse", "purremail", "Google Forms"],
		content: `<ol>
<li><p>Aktiver tilbakemeldinger på arrangementet og velg et publisert ${wiki("lage-skjema", "skjema")}, eller bruk standardskjemaet.</p></li>
<li><p>${wiki("oppmote-prikker", "Registrer oppmøte")}. Automatiske invitasjoner går til påmeldte med <strong>Oppmøtt</strong> eller <strong>Møtt sent</strong>. Arrangører er unntatt fra den automatiske utsendingen.</p></li>
<li><p>Åpne tilbakemeldingsoversikten for leveringsstatus og svar. Les resultatene i ${wiki("bedriftsrapport", "rapporten")}.</p></li>
</ol>
<p>Systemet sender invitasjoner og purrer dem som ikke har svart. Oppmøte som registreres senere, kan gi en senere invitasjon. Hvis en invitasjon mangler, sjekk oppmøtestatus, arrangørstatus og at utsendingen er aktiv.</p>`,
		facts: ["feedback"],
	}),
	guide({
		slug: "bedriftsrapport",
		title: "Sende bedriftsrapporten",
		category: "events",
		excerpt: "Se gjennom bedriftsversjonen og send rapportlenken til kontaktpersonen.",
		aliases: ["rapportering", "rapport", "feedback report", "PDF"],
		content: `<ol>
<li><p>Åpne rapporten på arrangementet når innsamlingen er avsluttet.</p></li>
<li><p>Se gjennom bedriftsversjonen og mottakeradressen. Fritekstsvar er med som standard. Under <strong>Tekstsvar</strong> kan du skjule svar før godkjenning.</p></li>
<li><p>Godkjenn og send. Bedriften får en rapportlenke på epost.</p></li>
<li><p>Kontroller leveringsstatus. Bruk ny sending hvis leveringen feilet.</p></li>
</ol>
<p>Hvis rapporten ble sendt til feil mottaker, trekk tilbake tilgangen. Rapporten kan da ikke sendes på nytt fra Bifrost.</p>`,
	}),
	guide({
		slug: "studenthjelp",
		title: "Hjelpe med påmelding og profil",
		category: "events",
		excerpt: "Frister, venteliste, prikker og studentprofil.",
		aliases: ["sperret", "låst", "kalender", "uteksaminert", "profil", "innlogging"],
		content: `<p>Be om arrangementet og feilmeldingen studenten ser.</p>
<ul>
<li><p><strong>Påmelding:</strong> sjekk åpningstid, frist, kapasitet og studentens status i deltakerlisten. Se også ${wiki("pameldinger-venteliste", "ventelisten")}.</p></li>
<li><p><strong>Sperre:</strong> åpne studenten under ${app("/students", "Studenter")} og les begrunnelsen. ${wiki("oppmote-prikker", "Rett feil oppmøtestatus")} på arrangementet.</p></li>
<li><p><strong>Profil:</strong> studenten kan endre studieprogram, grad og år under Profil på ifinavet.no.</p></li>
</ul>
<p>Studenter med plass kan legge arrangementet i kalenderen fra påmeldingen. Kalenderkopien kan ha gammel informasjon hvis arrangementet endres.</p>`,
	}),
	guide({
		slug: "produkter",
		title: "Opprette og endre produkter",
		category: "finance",
		excerpt: "Produktbeskrivelser, priser, mva, kapasitet og arkivering.",
		aliases: ["produktkatalog", "pakke", "pris", "mva"],
		content: `<ol>
<li><p>Åpne ${app("/products", "Produkter")} og opprett eller velg et produkt.</p></li>
<li><p>Sett kategori, navn, kort og utfyllende beskrivelse.</p></li>
<li><p>Legg inn avtalt pris og mva. Fyll ut volumpriser, oppstartspris og studentgrense hvis produktet bruker det.</p></li>
<li><p>Se gjennom forhåndsvisningen og lagre. Aktiver produktet for å tilby det, eller arkiver det når det ikke lenger skal selges.</p></li>
</ol>
<p>Prisendringer oppdaterer ikke tidligere ${wiki("salg-priser", "salg med lagret pris")}.</p>`,
		facts: ["products"],
	}),
	guide({
		slug: "salg-priser",
		title: "Priser og historiske salg",
		category: "finance",
		excerpt: "Lagret pris på salg og produktmerking av eldre avtaler.",
		aliases: ["salg", "volumpris", "sponsor", "produktmerking"],
		content: `<p>Et salg kan ha lagret produkt og pris fra da avtalen ble inngått. En endring i produktkatalogen endrer derfor ikke nødvendigvis salget.</p>
<p>Se produktet på arrangementet eller annonsebestillingen. Eldre arrangementer uten produktkobling kan merkes med produkt under ${app("/products/tag", "Produktmerking")}.</p>
<p>${wiki("fakturering", "Fakturagrunnlaget")} hentes fra salget. Når fakturaen markeres som sendt, lagrer Bifrost en kopi av opplysningene.</p>`,
	}),
	guide({
		slug: "fakturering",
		title: "Fakturere i Fiken",
		category: "finance",
		excerpt: "Opprett og send fakturaen i Fiken, marker den deretter som sendt i Bifrost.",
		aliases: ["faktura", "fakturering", "Fiken", "invoice", "EHF"],
		content: `<ol>
<li><p>Åpne posten under ${app("/invoicing", "Fakturaer")}. Bruk <strong>Kopier alt</strong> for å kopiere kundeopplysninger og fakturalinje.</p></li>
<li><p>Opprett og send fakturaen i Fiken.</p></li>
<li><p>Velg <strong>Marker som sendt</strong> i Bifrost. Knappen er tilgjengelig når leveransen er gjennomført og fakturagrunnlaget er komplett.</p></li>
</ol>
<p><strong>Angre sendt</strong> flytter posten tilbake til <strong>Ikke sendt</strong>. <strong>Avbryt faktura</strong> fjerner en usendt post fra det som skal faktureres. Ingen av handlingene endrer fakturaen i Fiken.</p>`,
	}),
	guide({
		slug: "opptaksperiode",
		title: "Opprette en opptaksperiode",
		category: "members",
		excerpt: "Sett frister, ta imot søknader og gå videre til intervjuer.",
		aliases: ["opptakssystem", "søknader", "rekruttering"],
		content: `<ol>
<li><p>Velg <strong>Start opptak</strong> under ${app("/admissions", "Opptak")}. Sett søknadsperiode, intervjudager og intervjuere.</p></li>
<li><p>Følg innkomne søknader i perioden og ${wiki("intervjuer", "planlegg intervjuene")}.</p></li>
<li><p>Etter intervjuene ${wiki("opptaksbeslutninger", "velger du kandidater og sender tilbud og avslag")}.</p></li>
</ol>
<p>Under periodens innstillinger finner du <strong>Avslutt opptaket</strong>. Dialogen viser ventende tilbud, kommende intervjuer og usendte beslutninger. Finnes det uavklarte punkter, kreves en ekstra bekreftelse.</p>
<p>Avslutning sletter periodens søknader og intervjudata etter at oppryddingen er fullført.</p>`,
	}),
	guide({
		slug: "intervjuer",
		title: "Planlegge intervjuer",
		category: "members",
		excerpt: "Tilgjengelighet, timeplan, invitasjoner og intervjunotater.",
		aliases: ["intervju", "kalender", "tilgjengelighet"],
		content: `<ol>
<li><p>Åpne opptaksperioden og velg Google-kalenderne som skal brukes for hver intervjuer. Opptatte tider utelates fra planforslaget.</p></li>
<li><p>Lag et forslag til intervjutider. Løs tidskonflikter og kontroller bemanningen.</p></li>
<li><p>Godkjenn og publiser planen for å sende invitasjonene. Et utkast sender ingen invitasjoner.</p></li>
<li><p>Før intervjunotater på kandidaten.</p></li>
</ol>
<p>Endre tidspunkter i opptakssystemet, slik at kalenderinvitasjonene følger endringen.</p>`,
	}),
	guide({
		slug: "opptaksbeslutninger",
		title: "Sende tilbud og avslag",
		category: "members",
		excerpt: "Velg kandidater, send beslutninger og følg svar på tilbud.",
		aliases: ["tilbud", "avslag", "kandidat", "utvelgelse"],
		content: `<ol>
<li><p>Gå gjennom kandidatene og intervjunotatene i opptaksperioden.</p></li>
<li><p>Registrer hvem som får tilbud og hvilke verv tilbudene gjelder.</p></li>
<li><p>Send beslutningene når utvelgelsen er ferdig. Registrering av en beslutning sender ikke epost alene.</p></li>
<li><p>Følg svarene på tilbudene. Kandidater som takker ja, følges videre under ${wiki("medlemskontoer", "medlemskontoer")}.</p></li>
</ol>`,
	}),
	guide({
		slug: "medlemskontoer",
		title: "Opprette og avslutte medlemskontoer",
		category: "members",
		excerpt: "Google-konto, velkomstmelding og avslutning av Google-, Bifrost- og Slack-tilgang.",
		aliases: ["IAM", "provisioning", "onboarding", "offboarding", "Google Workspace"],
		content: `<h2>Nytt medlem</h2>
<ol>
<li><p>Legg til medlemmet under ${app("/organization", "Organisasjon")}, eller åpne kontoen fra et akseptert opptakstilbud. Kontroller navn, UiO-adresse og Navet-adresse.</p></li>
<li><p>Bifrost oppretter Google-kontoen og sender velkomstmeldingen. Følg statusen på medlemmet hvis opprettelsen feiler.</p></li>
<li><p>Medlemmet aktiverer kontoen gjennom velkomstmeldingen og blir med i Slack via invitasjonen.</p></li>
</ol>
<h2>Avslutte medlemskap</h2>
<p>Start avslutning på medlemmet i Organisasjon. Bifrost suspenderer Google-kontoen og fjerner Bifrost-tilgangen. Deaktiver Slack-medlemskapet manuelt og bekreft det i Bifrost.</p>
<p>Se ${wiki("kontosynk", "kontosynkronisering")} hvis kontoene viser feil status.</p>`,
	}),
	guide({
		slug: "kontosynk",
		title: "Rette avvik i kontosynkronisering",
		category: "members",
		excerpt: "Sjekk medlemskontoer mot Google og Slack, og prøv feilede operasjoner på nytt.",
		aliases: ["IAM syncing", "synk", "reconcile", "Google", "Slack tilgang"],
		content: `<p>Bifrost sammenligner medlemskontoene med Google og Slack hver natt. Velg <strong>Sjekk Google og Slack nå</strong> under ${app("/organization", "Organisasjon")} for å starte en kontroll.</p>
<ul>
<li><p><strong>Venter på første innlogging:</strong> medlemmet må logge inn via velkomstmeldingen.</p></li>
<li><p><strong>Google-kontoen finnes allerede:</strong> kontroller at den tilhører medlemmet før du velger <strong>Bruk eksisterende konto</strong>.</p></li>
<li><p><strong>Suspendert Google-konto:</strong> avviket vises i listen. Reaktivering er ikke tilgjengelig fra denne listen.</p></li>
<li><p><strong>Google- eller Slack-konto uten medlemskap:</strong> velg <strong>Legg til som medlem</strong> hvis personen skal være medlem. Bruk <strong>Ignorer</strong> for kontoer som bevisst holdes utenfor medlemslisten.</p></li>
</ul>
<p>For en feilet kontooperasjon: rett årsaken i feilmeldingen og velg <strong>Prøv igjen</strong>.</p>`,
	}),
	guide({
		slug: "prognoser",
		title: "Påmeldingsprognoser og varsler",
		category: "insight",
		excerpt: "Påmeldingskurver og varsler om lav påmelding eller mange avmeldinger.",
		aliases: ["engagement", "prognose", "varsler", "avmeldinger"],
		content: `<p>Velg et kommende arrangement i ${app("/insight", "Innsikt")}. Påmeldingskurven viser utviklingen, og prognosen anslår videre påmelding ut fra tidligere arrangementer.</p>
<p>Varsler om ingen påmeldinger eller mange avmeldinger vises i Innsikt. Du kan skjule varsler som er fulgt opp.</p>
<p>En prognose kan mangle hvis det er for lite sammenlignbar historikk.</p>`,
	}),
	guide({
		slug: "sammenligne-innsikt",
		title: "Sammenligne semestre, bedrifter og mat",
		category: "insight",
		excerpt: "Oppmøte, avmeldinger og erfaringer fra tidligere arrangementer.",
		aliases: ["statistikk", "oppmøte", "historikk", "matinnsikt"],
		content: `<p>I ${app("/insight", "Innsikt")} kan du sammenligne semestre og bedrifter, se tidligere arrangementer og undersøke erfaringer med serveringen. Velg perioden du vil sammenligne.</p>
<p>Velg et arrangement i <strong>Tidligere</strong> eller <strong>Per bedrift</strong> for å se påmeldingskurven. Under <strong>Tidligere</strong> ser du også målgruppen. Feil i oppmøte, registrert mat eller bedriftstilknytning rettes på arrangementet.</p>`,
	}),
	guide({
		slug: "leaderboard",
		title: "Leaderboard",
		category: "insight",
		excerpt: "Rangering etter deltakelse og arrangørarbeid.",
		aliases: ["toppliste", "rangering"],
		content: `<p>${app("/leaderboard", "Leaderboardet")} teller arrangementer du har møtt på og arrangementer du står oppført som arrangør for. Bare arrangementer som har startet, teller. Velg et semester eller hele perioden.</p>
<p>Mangler et arrangement i tellingen, sjekk oppmøtestatusen eller ansvarstildelingen på arrangementet.</p>`,
	}),
	guide({
		slug: "lage-skjema",
		title: "Lage tilbakemeldingsskjemaer",
		category: "tools",
		excerpt: "Spørsmål, publisering, standardskjema og skjemaversjoner.",
		aliases: ["skjemaer", "skjemabygger", "survey", "form", "spørsmål"],
		content: `<ol>
<li><p>Åpne ${app("/feedback-forms", "Skjemaer")} og opprett et skjema eller rediger et utkast.</p></li>
<li><p>Legg inn spørsmål, svaralternativer og hvilke svar som er påkrevd. Se gjennom rekkefølgen i forhåndsvisningen.</p></li>
<li><p>Publiser versjonen. Velg den på arrangementet, eller sett skjemaet som standard.</p></li>
</ol>
<p>Når utsendingen har startet, er arrangementet låst til skjemaversjonen. Senere endringer publiseres som en ny versjon for fremtidige utsendinger. Skjul skjemaer som ikke lenger skal brukes.</p>`,
		facts: ["forms"],
	}),
	guide({
		slug: "bestillingsskjema",
		title: "Endre annonsebestillingsskjemaet",
		category: "tools",
		excerpt: "Åpne eller steng bestillinger, endre introtekst og ansettelsesformer.",
		aliases: ["annonse skjema", "bestillingsinnstillinger"],
		content: `<p>Åpne annonsebestillingsinnstillingene under ${app("/feedback-forms", "Skjemaer")}. Her kan du:</p>
<ul>
<li><p>åpne eller stenge for nye bestillinger</p></li>
<li><p>endre teksten øverst i skjemaet</p></li>
<li><p>sette tegnbegrensninger for tittel og intro</p></li>
<li><p>legge til eller fjerne ansettelsesformer</p></li>
</ul>
<p>Lagre endringene. Priser og annonseprodukter endres under ${wiki("produkter", "Produkter")}.</p>`,
	}),
	guide({
		slug: "slack-varsler",
		title: "Navet-botten i Slack",
		category: "tools",
		excerpt: "Bedriftskanaler og påminnelser om planlegging, oppmøte og etterarbeid.",
		aliases: ["Slack bot", "Navet bot", "purring", "påminnelser", "bedriftskanal"],
		content: `<p>Botten oppretter private kanaler for bedrifter og semestre, inviterer ansvarlige og minner om uferdige oppgaver.</p>
<p>Følg lenken i varselet og fullfør oppgaven i Bifrost. Et svar i Slack krysser ikke av sjekklisten eller godkjenner en utsending.</p>
<p>Ved gjentatte varsler: sjekk om sjekklisten, oppmøtet eller utsendingen fortsatt står som uferdig. Mangler du tilgang til kanalen, sjekk ansvarstildelingen på arrangementet.</p>`,
		facts: ["slack"],
	}),
	guide({
		slug: "offentlige-sider",
		title: "Oppdatere offentlige sider",
		category: "tools",
		excerpt: "Endre innholdet på ifinavet.no fra Bifrost.",
		aliases: ["Midgard", "nettside", "innhold"],
		content: `<ol>
<li><p>Åpne siden under ${app("/pages", "Sider")} og rediger tittel og innhold.</p></li>
<li><p>Lagre og åpne siden på ifinavet.no. Sjekk lenker og at innholdet vises riktig på mobil.</p></li>
</ol>
<p>Hvis sidens adresse endres, oppdater lenkene som peker til den.</p>`,
	}),
	guide({
		slug: "epost-feilsoking",
		title: "Epost som ikke kommer frem",
		category: "tools",
		excerpt: "Godkjenning, leveringsstatus, søppelpost og utløpte bekreftelseslenker.",
		aliases: ["epost", "email", "bekreftelseslenke", "bounce", "retry"],
		content: `<ol>
<li><p>Åpne søknaden, kontoen eller utsendingen og kontroller mottakeradressen.</p></li>
<li><p>Sjekk om sendingen venter på godkjenning. Påminnelsesepost og bedriftsrapport må godkjennes før de sendes.</p></li>
<li><p>Les leveringsstatus. Ved feil, rett årsaken før du prøver igjen. Hvis eposten er levert, be mottakeren sjekke søppelpost.</p></li>
<li><p>Har bekreftelseslenken til bedpress-søknaden utløpt, må kontaktpersonen sende inn søknaden på nytt fra bestillingsskjemaet.</p></li>
</ol>`,
	}),
];
