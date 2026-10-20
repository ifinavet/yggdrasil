import { EVENT_EXPENSE_TEMPLATE_URL } from "@workspace/shared/constants";
import type { WikiArticle, WikiCategory, WikiFact } from "@workspace/shared/wiki";

type Guide = {
	slug: string;
	title: string;
	category: WikiCategory;
	excerpt: string;
	before: string;
	steps: string[];
	automatic: string;
	verify: string;
	recovery: string;
	related?: string[];
	aliases?: string[];
	facts?: WikiFact[];
	owner?: string;
};
function guide(input: Guide): WikiArticle {
	return {
		slug: input.slug,
		title: input.title,
		category: input.category,
		excerpt: input.excerpt,
		aliases: input.aliases ?? [],
		relatedSlugs: input.related ?? [],
		facts: input.facts ?? [],
		owner: input.owner ?? "Styret",
		policy: false,
		content: `<h2>Før du begynner</h2><p>${input.before}</p><h2>Slik gjør du det</h2><ol>${input.steps.map((step) => `<li><p>${step}</p></li>`).join("")}</ol><h2>Dette skjer automatisk</h2><p>${input.automatic}</p><h2>Sjekk at du er ferdig</h2><p>${input.verify}</p><h2>Hvis noe går galt</h2><p>${input.recovery}</p>`,
	};
}
const wiki = (slug: string, label: string) => `<a href="/wiki/${slug}">${label}</a>`;
const app = (path: string, label: string) => `<a href="${path}">${label}</a>`;

export const HANDBOOK_ARTICLES: WikiArticle[] = [
	guide({
		slug: "finn-frem",
		title: "Finn frem i Navets systemer",
		category: "start",
		excerpt: "Hvilket system bruker du, og hvor finner du neste oppgave?",
		aliases: ["Bifrost", "Hugin", "Midgard", "kom i gang"],
		before: "Ha Navet-kontoen din tilgjengelig. Håndboken samler rutinene for hele foreningen.",
		steps: [
			`Bruk Bifrost til arrangementer, bedrifter, semesterplan, opptak, produkter og fakturaoppfølging. Start i menyen til venstre.`,
			"ifinavet.no er den offentlige nettsiden. Hugin håndterer blant annet studentpåmelding og lenker bedrifter og søkere mottar.",
			`Finn fremgangsmåten i håndboken. Søk etter oppgaven, for eksempel «fakturering», «bedpres» eller «IAM». Lagre artikler du bruker ofte med bokmerket.`,
			"Slack viser oppgaver og varsler med lenker tilbake til Bifrost. Google Workspace brukes til epost, kalender og dokumenter. Fiken brukes til å opprette og sende fakturaer.",
		],
		automatic:
			"Bifrost oppdaterer lister og status når data endres. Korte veiledninger på funksjonssidene lenker til de utfyllende rutinene.",
		verify: "Du vet hvor oppgaven utføres og hvor status kontrolleres.",
		recovery:
			"Søk på et alternativt ord eller gå via en kategori. Meld fra om feil i artikkelen dersom rutinen ikke stemmer.",
		related: ["holde-bedpress", "oppdatere-handboken", "slack-varsler"],
	}),
	guide({
		slug: "holde-bedpress",
		title: "Holde bedpress, fra planlegging til etterarbeid",
		category: "events",
		excerpt:
			"Start her når du har ansvar for en bedriftspresentasjon. Følg seks korte etapper og åpne detaljene når du trenger dem.",
		aliases: [
			"bedpres",
			"bedpress",
			"bedriftspresentasjon",
			"hvordan holde bedpress",
			"første arrangement",
		],
		owner: "Arrangementsansvarlig",
		before: `Finn arrangementet i ${app("/events", "Arrangementer")}. Kontroller hvem som er hovedansvarlig og medhjelpere.`,
		steps: [
			`${wiki("planlegge-med-bedriften", "Planlegg med bedriften")}: se tidligere erfaringer, avklar pakke, format, tidspunkt, sted, mat og eventuell stand.`,
			`${wiki("publisere-arrangement", "Gjør arrangementet klart")}: godkjenn teksten, kontroller påmeldingstidene og kapasiteten, og avklar promotering.`,
			`${wiki("sjekkliste", "Følg sjekklisten")}: bekreft rom, mat og medhjelpere. ${wiki("praktisk-arrangement", "Gjør praktiske forberedelser")}.`,
			`${wiki("paminnelse-epost", "Se gjennom og send påminnelsen")}: legg inn praktisk informasjon og kontroller utsendingen i Bifrost.`,
			`${wiki("oppmote-prikker", "Registrer oppmøte")}: bruk QR eller deltakerlisten og rett eventuelle feil. Minn deltakerne om tilbakemeldingen.`,
			`${wiki("tilbakemeldinger", "Følg med på tilbakemeldingene")}, ${wiki("bedriftsrapport", "godkjenn bedriftsrapporten")} og ${wiki("utlegg", "lever kvitteringer og utlegg")}. Følg opp bedriften.`,
		],
		automatic:
			"Når tilbakemeldinger er aktivert, håndterer systemet invitasjoner og purringer til kvalifiserte deltakere. Slack følger opp uferdige oppgaver. Påminnelsesepost og bedriftsrapport krever at du ser gjennom og godkjenner sendingen.",
		verify:
			"Alle deltakere har riktig oppmøtestatus. Rapportens leveringsstatus er kontrollert, kvitteringer er levert og etterarbeidet er krysset av.",
		recovery:
			"Åpne artikkelen for trinnet som stopper opp. Bruk leveringsstatus og feilmelding før du prøver en utsending igjen. Den tidligere bedpress-guiden er bevart i versjonshistorikken.",
		related: [
			"planlegge-med-bedriften",
			"sjekkliste",
			"paminnelse-epost",
			"oppmote-prikker",
			"tilbakemeldinger",
			"bedriftsrapport",
		],
	}),
	guide({
		slug: "oppdatere-handboken",
		title: "Oppdatere håndboken og melde fra om feil",
		category: "start",
		excerpt: "Rediger i Bifrost, kontroller innholdet og bevar tidligere versjoner.",
		aliases: ["wiki", "dokumentasjon", "hjelp", "ressurser"],
		before:
			"Åpne artikkelen du vil forbedre. Nye artikler bør beskrive én oppgave med et konkret resultat.",
		steps: [
			"Velg Rediger. Endre tekst, sammendrag, kategori og søkeord. Artikkeladressen er fast etter opprettelse, slik at lenker fortsetter å virke.",
			"Lagre et utkast når arbeidet pågår. Leserne ser fortsatt den publiserte versjonen. Se gjennom forhåndsvisningen før du publiserer.",
			"Kontroller fremgangsmåten mot funksjonen. Bruk Marker som kontrollert når den publiserte teksten stemmer. Dette er en egen handling etter publisering.",
			"Åpne Oppfølging for artikler som trenger kontroll, utkast og feilmeldinger. Rett feilen før du lukker meldingen.",
			"Bruk Historikk for å lese en tidligere versjon eller gjenopprette den som utkast. Ta utdaterte artikler ut av bruk med en forklaring og helst en erstatning.",
		],
		automatic:
			"Søk oppdateres ved publisering. Faktafelter følger systemets data. Endringer i tilknyttet kode gir beskjed om ny gjennomgang. Ingen tekst blir omskrevet automatisk.",
		verify:
			"Søket finner riktig publisert artikkel, lenkene virker og kontrolltidspunktet er korrekt. Vanlige rutiner gjennomgås hvert kvartal, policy årlig.",
		recovery:
			"Ved redigeringskonflikt: kopier egen tekst før du laster siste versjon. Meld fra om feil hvis du ikke kan rette den selv.",
		related: ["finn-frem"],
	}),
	guide({
		slug: "bedriftssoknader",
		title: "Motta og behandle bedriftssøknader",
		category: "companies",
		excerpt: "Fra bedriftens epostbekreftelse til en søknad som kan planlegges.",
		aliases: ["bestille bedpres", "bestilling", "bedpress bestilling", "søknad", "Google Sheets"],
		before: `Åpne ${app("/semesterplan", "Semesterplan")} og velg riktig semester.`,
		steps: [
			"Kontroller at semesterets søknadsperiode og tilgjengelige tilbud er riktig satt opp.",
			"Bedriften fyller ut bestillingen og bekrefter epostadressen gjennom lenken den mottar. Søknaden blir først synlig for Navet etter denne bekreftelsen.",
			"Les ønskene, kontaktinformasjonen og fakturadetaljene før du fordeler dato og produkt. Bruk søknaden som grunnlag for videre dialog.",
			"Kontroller semesterets mal for bekreftelsesepost. Plassholderen {bedrift} brukes til bedriftsnavnet.",
		],
		automatic:
			"Systemet sender bekreftelseslenke og registrerer bekreftelsen. En kopi til Google Sheets er bare tilgjengelig når integrasjonen er konfigurert; Bifrost er oversikten du skal arbeide fra.",
		verify: "Søknaden står i riktig semester med bekreftet kontakt og riktig bestilling.",
		recovery:
			"Hvis en bedrift mangler i oversikten, undersøk epostbekreftelsen før du oppretter en ekstra søknad. Ikke slett en søknad som har fakturahistorikk; avklar endringen i fakturaoppfølgingen.",
		related: ["semesterplan", "epost-feilsoking", "fakturering"],
	}),
	guide({
		slug: "semesterplan",
		title: "Planlegge semester og sende tilbud",
		category: "companies",
		excerpt: "Fordel arrangementer, kontroller avtalen og følg opp tilbudet til bedriften.",
		aliases: ["semesterplanlegging", "tilbud", "datoer", "CSV"],
		before: `Åpne ${app("/semesterplan", "Semesterplan")}. Ha avklarte arrangementsdager, produkter og søknader tilgjengelig.`,
		steps: [
			"Velg semester og kontroller datoene. Se søknader og ønsker samlet før du fordeler plassene.",
			"Tildel bedriften passende dato og produkt. Kontroller kapasitet, pris og kontaktperson i tilbudet.",
			"Se gjennom tilbudet og send det fra tilbudsflyten. Følg status og bedriftens svar før du behandler avtalen som avklart.",
			"Kontroller det tilhørende arrangementet i Arrangementer og fordel ansvarlige. Bruk CSV-eksport når du trenger en avgrenset kopi til videre arbeid.",
		],
		automatic:
			"Avtale og arrangement kobles gjennom semesterflyten. Epost og tilbudslenker blir laget av systemet når du sender.",
		verify:
			"Bedriften, datoen, produktet og arrangementet stemmer overens. Ingen bedrift er dobbeltbooket.",
		recovery:
			"Rett feil i søknad eller tilbud før du sender på nytt. Kontroller eksisterende utsending og avtale før du lager en ny.",
		related: ["bedriftssoknader", "planlegge-med-bedriften", "produkter"],
	}),
	guide({
		slug: "planlegge-med-bedriften",
		title: "Planlegge arrangementet med bedriften",
		category: "companies",
		excerpt: "Bruk planleggingslenken til å samle opplegget og godkjenn svaret før publisering.",
		aliases: ["førstegangskontakt", "planleggingsskjema", "kontaktperson"],
		before:
			"Åpne arrangementet. Kontroller bedrift, kontaktadresse, avtalt produkt og ansvarlige. Les historikken fra tidligere samarbeid.",
		steps: [
			"Se gjennom planleggingsinvitasjonen og signaturen. Send den til riktig kontaktperson når den er klar.",
			"Bedriften fyller ut den private planleggingslenken med format, tekst, sted, mat, kapasitet og andre ønsker. Kontaktbekreftelse inngår i flyten.",
			"Les svaret og avklar uavklarte ønsker direkte med bedriften. Kontroller at kapasiteten passer den avtalte pakken.",
			"Godkjenn opplegget og kontroller arrangementsteksten før publisering. Bekreft rom, restaurant og bestillinger separat.",
		],
		automatic:
			"Systemet klargjør planleggingsflyten i forkant av arrangementet. Bedriftens innspill samles på arrangementet; de skal vurderes internt før publisering.",
		verify:
			"Opplegget er godkjent, praktiske bestillinger er bekreftet og arrangementet har riktig informasjon.",
		recovery:
			"Ved feil kontaktadresse: bruk korrigering og ny sending i planleggingsflyten. Tidligere lenker kan bli ugyldige. Se leveringsstatus før du sender på nytt.",
		related: ["bedriftshistorikk", "publisere-arrangement", "praktisk-arrangement"],
		facts: ["products"],
	}),
	guide({
		slug: "annonsebestilling",
		title: "Behandle bestilling av stillingsannonse",
		category: "companies",
		excerpt: "Kontroller bestillingen, godkjenn eller avvis, og følg opp fakturagrunnlaget.",
		aliases: ["annonse ordering", "jobbannonse", "stillingsannonse", "EHF"],
		before: `Åpne ${app("/job-listings", "Stillingsannonser")} og bestillingsoversikten.`,
		steps: [
			"Åpne bestillingen og les annonsetekst, frist, bedrift, produkt og kontaktinformasjon.",
			"Kontroller fakturadetaljer, organisasjonsnummer og eventuell EHF-informasjon. Noter relevante avklaringer i bestillingen.",
			"Godkjenn når innholdet er klart. Ved avvisning skriver du en konkret begrunnelse som hjelper bedriften videre.",
			"Kontroller den publiserte annonsen og fakturagrunnlaget. Bruk søk og visning av utløpte annonser for historikk. Annonser kan også opprettes manuelt fra oversikten.",
		],
		automatic:
			"Godkjenning publiserer annonsen og varsler bedriften. Bestillingsflyten sender mottaksbekreftelse. Fakturagrunnlaget følger bestillingen.",
		verify: "Riktig annonse er publisert med riktig frist, og bestillingen har korrekt status.",
		recovery:
			"Undersøk om bestillingen allerede er behandlet før du oppretter en manuell annonse. Rett eller avklar innholdet før ny publisering.",
		related: ["fakturering", "produkter", "bestillingsskjema"],
	}),
	guide({
		slug: "bedriftshistorikk",
		title: "Finne historikken til en bedrift",
		category: "companies",
		excerpt: "Bruk tidligere arrangementer, annonser og tilbakemeldinger i neste dialog.",
		aliases: ["CRM", "tidslinje", "bedriftssøk"],
		before: `Finn bedriften i ${app("/companies", "Bedrifter")}.`,
		steps: [
			"Søk på bedriften og åpne detaljsiden. Kontroller at du har riktig organisasjon.",
			"Les tidslinjen for tidligere arrangementer og stillingsannonser. Åpne det konkrete arrangementet for rapport og oppfølging.",
			"Ta med relevante erfaringer til neste planlegging. Se Innsikt for sammenligning der data finnes.",
		],
		automatic: "Tidslinjen samler samarbeid som er registrert i systemet.",
		verify: "Du har funnet riktig samarbeid og kan åpne kilden bak opplysningene.",
		recovery:
			"Hvis noe mangler, kontroller koblingen mellom arrangementet eller annonsen og bedriften. Innsikt kan ha et avgrenset historikkvindu; fravær der betyr ikke at samarbeidet aldri fant sted.",
		related: ["planlegge-med-bedriften", "sammenligne-innsikt"],
	}),
	guide({
		slug: "publisere-arrangement",
		title: "Opprette og publisere et arrangement",
		category: "events",
		excerpt: "Få riktig tekst, kapasitet, ansvar og påmeldingstider på plass før publisering.",
		aliases: ["ny bedpres", "publisering", "eksternt arrangement"],
		before: `Åpne ${app("/events", "Arrangementer")}. Sjekk først om semesterplanen allerede har opprettet arrangementet.`,
		steps: [
			"Åpne eksisterende arrangement eller velg å lage et nytt. Velg riktig semester, bedrift og produkt der dette er relevant.",
			"Fyll ut tittel, kort introduksjon og beskrivelse. Kontroller dato, sted, kapasitet, påmeldingsåpning og avmeldingsfrist.",
			"Velg hovedansvarlig og medhjelpere. Avklar mat og hvilken tilbakemeldingsflyt arrangementet skal bruke.",
			"Se gjennom siden, lagre og publiser når den er klar. Eksterne arrangementer kan bruke en ekstern lenke; kontroller at lenken leder til riktig påmelding.",
		],
		automatic:
			"Påmelding følger tidene på arrangementet. Den offentlige siden oppdateres fra publisert innhold. Slack kan varsle om manglende tekst og forberedelser.",
		verify:
			"Åpne den offentlige arrangementssiden og kontroller innhold og påmeldingsinformasjon. Bruk arrangementets faktiske tider, ikke en fast regel fra en gammel mal.",
		recovery:
			"Behold utkastet mens informasjon mangler. Ved duplikater må koblinger til bestilling, påmeldinger og faktura avklares før noe slettes.",
		related: ["sjekkliste", "tilbakemeldinger", "pameldinger-venteliste"],
	}),
	guide({
		slug: "sjekkliste",
		title: "Følge arrangementets sjekkliste",
		category: "events",
		excerpt: "Samle fremdriften på arrangementet, fra kontakt med bedriften til etterarbeid.",
		aliases: ["sjekkliste", "medhjelper", "promotering"],
		before: "Åpne arrangementet og kontroller hvem som har ansvar.",
		steps: [
			"Arbeid gjennom fasene i rekkefølge. Kryss av først når oppgaven faktisk er avklart eller gjennomført.",
			"Bekreft medhjelpere direkte med dem. En registrert tildeling erstatter ikke avklaringen.",
			"Avklar promotering med PR-ansvarlig og kontroller prognosen i Innsikt.",
			"Fullfør etterarbeidet med utlegg og oppfølging av bedriften.",
		],
		automatic:
			"Fremdriften deles med de andre i Bifrost. Slack følger opp relevante punkter som fortsatt står åpne.",
		verify:
			"Sjekklisten samsvarer med arbeidet som er gjort. Ingen separat kopi i semesterregnearket trengs for fremdriften.",
		recovery:
			"Ta bort avkrysningen hvis en avklaring faller bort. Avtal hvem som følger opp videre.",
		facts: ["checklist"],
		related: ["holde-bedpress", "slack-varsler"],
	}),
	guide({
		slug: "pameldinger-venteliste",
		title: "Følge påmeldinger og venteliste",
		category: "events",
		excerpt: "Se hvem som har plass, hvem som venter og hvilke tilbud som må besvares.",
		aliases: ["venteliste", "påmeldinger", "tilbud om plass", "avmelding"],
		before: "Åpne arrangementet og deltakerlisten. Kontroller kapasitet og registreringsfrister.",
		steps: [
			"Skill mellom bekreftet plass, venteliste og tilbud som venter på svar. Ikke regn et uavklart tilbud som endelig oppmøte.",
			"Studenter svarer på tilbudet gjennom lenken eller påmeldingssiden. Bruk tilbudets faktiske frist når du hjelper dem.",
			"Kontroller listen etter endringer i kapasitet eller avmelding. Be studenter melde seg på gjennom den ordinære flyten.",
			"Ved manuell håndtering: kontroller student og arrangement nøye før du endrer noe.",
		],
		automatic:
			"Ventelisten håndterer ledige plasser og tilbud. Systemet rydder også uavklarte tilbud gjennom den etablerte livssyklusen.",
		verify:
			"Påmeldingsstatus og kapasitet stemmer. Før oppmøte bruker du den oppdaterte deltakerlisten.",
		recovery:
			"Undersøk status og utløpsfrist før du lover en plass. Ved sperre, se studentens prikker og eventuell låsing.",
		related: ["oppmote-prikker", "studenthjelp", "prognoser"],
	}),
	guide({
		slug: "oppmote-prikker",
		title: "Registrere oppmøte og rette prikker",
		category: "events",
		excerpt:
			"Registrer alle deltakere riktig. En rettet oppmøtestatus retter også prikkene fra samme påmelding.",
		aliases: ["prikkesystem", "prikksystem", "QR", "fravær", "møtt sent", "ikke møtt"],
		before:
			"Åpne riktig arrangement og deltakerlisten. Ha en enhet klar til QR-skanning eller navnesøk.",
		steps: [
			"Skann studentens QR-kode eller finn studenten i listen. Marker Oppmøtt eller Møtt sent etter det faktiske oppmøtet.",
			"Når innslippet er avklart, marker Ikke møtt for påmeldte som ikke kom. Fullfør alle uavklarte registreringer.",
			"Ved feil: endre oppmøtestatus på samme registrering. Ikke legg til en ny manuell prikk for å kompensere.",
			`Bruk ${app("/students", "Studenter")} for å kontrollere andre prikker, begrunnelse og eventuell påmeldingssperre.`,
		],
		automatic:
			"Oppmøtestatus gir prikker etter reglene nedenfor. Korrigering erstatter tidligere prikker fra den samme påmeldingen. Tilbakemeldingsflyten bruker oppmøtet for å velge mottakere.",
		verify:
			"Alle registreringer har riktig status, og studentens prikker samsvarer med den. Oppmøtedata lagres i Bifrost.",
		recovery:
			"Avklar ukjent oppmøte med medhjelperne. Ikke marker oppmøte bare for å få sendt et tilbakemeldingsskjema. Organisatoriske unntak må avklares med ansvarlig.",
		facts: ["attendance"],
		related: ["tilbakemeldinger", "studenthjelp"],
	}),
	guide({
		slug: "paminnelse-epost",
		title: "Se gjennom og sende påminnelsesepost",
		category: "events",
		excerpt: "Send studentene praktisk informasjon fra arrangementet og kontroller leveringen.",
		aliases: ["reminder", "påminnelse", "epost", "BCC", "blindkopi"],
		before:
			"Åpne arrangementet før det starter. Avklar hva studentene må vite om sted, utstyr og forberedelser.",
		steps: [
			"Åpne påminnelsesflyten på arrangementet. Skriv den praktiske informasjonen som mangler fra standardteksten.",
			"Les forhåndsvisningen og kontroller arrangement, tidspunkt og mottakere.",
			"Godkjenn sendingen når teksten er klar. Godkjenning starter utsendingen med en gang.",
			"Kontroller leveringsstatus. Bruk ny sending for feilede leveringer der funksjonen tilbyr det.",
		],
		automatic:
			"Slack minner ansvarlige om å se gjennom påminnelsen. Bifrost sporer utsendingen og unngår å sende på nytt til mottakere som allerede fikk den.",
		verify:
			"Påminnelsen står som sendt eller levert, og eventuelle feil er fulgt opp. En Slack-påminnelse betyr ikke at studenteposten er sendt.",
		recovery:
			"Se feilmeldingen og korriger årsaken før du prøver igjen. Den gamle rutinen med manuell blindkopi én uke og to dager før gjelder ikke for denne flyten.",
		related: ["slack-varsler", "epost-feilsoking", "praktisk-arrangement"],
	}),
	guide({
		slug: "tilbakemeldinger",
		title: "Følge automatiske tilbakemeldinger",
		category: "events",
		excerpt:
			"Kontroller skjema, oppmøte og leveringsstatus. Systemet håndterer invitasjoner og purringer.",
		aliases: ["feedback", "evaluering", "spørreundersøkelse", "purremail", "Google Forms"],
		before:
			"Kontroller arrangementets tilbakemeldingsinnstillinger og at et publisert skjema er valgt eller tilgjengelig som standard.",
		steps: [
			"Se gjennom skjemaet før arrangementet. Bruk testsending når du vil kontrollere visning og tekst.",
			"Registrer oppmøte korrekt. Invitasjonene gjelder deltakere som møtte, med unntak for arrangørene.",
			"Åpne tilbakemeldingsoversikten etter arrangementet. Kontroller kampanjestatus, utsendinger og svar.",
			"Bruk den manuelle utsendingsfunksjonen ved behov og les hvilke mottakere som er kvalifisert. Sen oppmøteregistrering håndteres også av systemet.",
		],
		automatic:
			"Invitasjoner og purringer følger tidene nedenfor. De som har svart, skal ikke purres videre. Skjemaversjonen låses når utsendingen har startet.",
		verify:
			"Riktig skjema er brukt, oppmøtet er komplett og leveringsfeil er fulgt opp. Les svarene i rapportvisningen.",
		recovery:
			"Ved manglende invitasjon: kontroller oppmøte, arrangørstatus, skjema og kampanjens status. Ikke opprett et parallelt Google Forms-skjema for samme arrangement.",
		facts: ["feedback"],
		related: ["lage-skjema", "oppmote-prikker", "bedriftsrapport", "epost-feilsoking"],
	}),
	guide({
		slug: "bedriftsrapport",
		title: "Kontrollere og dele bedriftsrapporten",
		category: "events",
		excerpt: "Les den interne rapporten, vurder innholdet og send bedriften en egen rapportlenke.",
		aliases: ["rapportering", "rapport", "feedback report", "PDF"],
		before: "Åpne arrangementets rapport og kontroller oppmøte og tilbakemeldinger.",
		steps: [
			"Les den interne rapporten og noter forhold som bør følges opp med bedriften.",
			"Se gjennom bedriftsversjonen og mottakeradressen. Bedriftsversjonen er tilpasset deling og inneholder ikke individuelle fritekstsvar.",
			"Godkjenn og send rapporten når den er klar. En tidlig rapport kan deles gjennom funksjonen når den er tilgjengelig.",
			"Kontroller leveringsstatus. Bruk funksjonene for ny sending eller tilbaketrekking av lenke ved behov.",
		],
		automatic:
			"Rapportvisningen oppdateres fra arrangementets data. Slack varsler om oppfølging og usendt rapport. Rapporten sendes som en sikker lenke etter godkjenning.",
		verify:
			"Rapporten er levert til riktig kontakt og eventuelle oppfølgingspunkter er håndtert. Ikke lag en ekstra PDF-rapport som erstatning for denne flyten.",
		recovery:
			"Rett oppmøte eller data ved kilden. Ved feil mottaker må lenken trekkes tilbake og riktig deling avklares. Se leveringsstatus før ny sending.",
		related: ["tilbakemeldinger", "bedriftshistorikk", "slack-varsler"],
	}),
	guide({
		slug: "praktisk-arrangement",
		title: "Avklare rom, mat, stand og utstyr",
		category: "events",
		excerpt: "De praktiske avtalene må fortsatt bekreftes, selv om Bifrost minner deg på dem.",
		aliases: ["rombooking", "mat", "restaurant", "stand", "kaffe", "utstyr"],
		owner: "Arrangementsansvarlig",
		before:
			"Ha bedriftens opplegg, kapasitet og ønsker tilgjengelig. Avklar praktisk ansvar med organiseringsansvarlig og medhjelperne.",
		steps: [
			"Bekreft rom eller restaurant og nødvendig utstyr med ansvarlig. Registrer riktig sted på arrangementet.",
			"Avklar servering, allergier, tidspunkt, antall og hvem som bestiller og betaler. Registrer maten på arrangementet der det er relevant.",
			"Avklar eventuell stand og promotering med PR-ansvarlig. Kontroller gjeldende avtale før du lover tillegg.",
			"Ta med laptop til oppmøte, vann og kaffe til bedriften og nødvendig serveringsutstyr. Sjekk presentasjonsutstyret før start.",
			"Ta vare på alle kvitteringer, også ved betaling med Navet-kortet. Kryss av sjekklisten etter bekreftelse.",
		],
		automatic:
			"Bifrost og Slack hjelper med oppfølging, men foretar ikke rom- eller restaurantbestillingen for deg. Matdata kan brukes i Innsikt.",
		verify:
			"Du har bekreftede avtaler, tydelig betalingsansvar og fungerende utstyr. Matadministrasjon som ikke vises i menyen kan fortsatt være under utprøving.",
		recovery:
			"Kontakt ansvarlig hvis kapasitet, mat eller lokale endres. Oppdater arrangementet og vurder om deltakerne trenger ny praktisk informasjon.",
		related: ["sjekkliste", "paminnelse-epost", "utlegg"],
	}),
	guide({
		slug: "studenthjelp",
		title: "Hjelpe en student med påmelding og profil",
		category: "events",
		excerpt: "Finn årsaken til påmeldingsproblemer og hjelp studenten gjennom riktig flyt.",
		aliases: ["sperret", "låst", "kalender", "uteksaminert", "profil", "innlogging"],
		before:
			"Be om hvilket arrangement og hvilken feilmelding studenten ser. Kontroller riktig student i Bifrost.",
		steps: [
			"Sjekk påmeldingsåpning, frist, kapasitet, eventuell venteliste og studentens eksisterende registrering.",
			"Kontroller aktive prikker og eventuell kontolåsing. Les begrunnelsen før du endrer noe.",
			"Be studenten kontrollere innlogging og nødvendige profilopplysninger. Uteksaminerte brukere har en egen profilflyt.",
			"Studenter med plass kan bruke kalenderfunksjonen fra påmeldingen. Kontroller dato og sted i kalenderoppføringen ved endringer.",
		],
		automatic:
			"Påmeldingsflyten bruker kapasitet, status og sperrer. En kalenderkopi kan leve utenfor Bifrost, så studenten bør alltid kontrollere oppdatert arrangementsinformasjon.",
		verify: "Studenten ser riktig registreringsstatus, og en eventuell feil er rettet ved kilden.",
		recovery:
			"Eskaler med arrangement, tidspunkt og feilmelding hvis problemet vedvarer. Unngå å opprette flere kontoer eller registreringer for å omgå problemet.",
		related: ["pameldinger-venteliste", "oppmote-prikker"],
	}),
	guide({
		slug: "produkter",
		title: "Opprette og vedlikeholde produkter",
		category: "finance",
		excerpt: "Hold produktbeskrivelser, priser, kapasitet og salgsgrunnlag oppdatert.",
		aliases: ["produktkatalog", "pakke", "pris", "mva"],
		owner: "Økonomiansvarlig",
		before: `Åpne ${app("/products", "Produkter")}. Avklar vedtatt produkt, pris og avgiftsbehandling med økonomiansvarlig.`,
		steps: [
			"Opprett produktet eller åpne et eksisterende. Velg riktig kategori og skriv en kort og en utfyllende beskrivelse.",
			"Fyll inn pris og mva, og eventuelle volumpriser, oppstartspris og studentgrense som produktet bruker.",
			"Se gjennom forhåndsvisningen før du lagrer. Kontroller at produktet er aktivt og har riktig plassering i oversikten.",
			"Arkiver produkter som ikke lenger skal tilbys. Bruk historikken når du undersøker en endring.",
		],
		automatic:
			"Aktive produkter brukes i relevante bestillingsflater. Historiske salg kan beholde lagret produkt- og prisinformasjon selv om dagens katalog endres.",
		verify: "Riktig navn, beskrivelse og pris vises i den aktuelle bestillingsflyten.",
		recovery:
			"Avklar konsekvensene for eksisterende tilbud før du endrer pris. Rett konkrete salg og fakturagrunnlag separat hvis de inneholder feil.",
		facts: ["products"],
		related: ["salg-priser", "fakturering"],
	}),
	guide({
		slug: "salg-priser",
		title: "Kontrollere pris og produkt på et salg",
		category: "finance",
		excerpt: "Skille dagens produktkatalog fra avtalt pris og historiske salg.",
		aliases: ["salg", "volumpris", "sponsor", "produktmerking"],
		owner: "Økonomiansvarlig",
		before: "Åpne søknaden, arrangementet eller annonsebestillingen som salget gjelder.",
		steps: [
			"Kontroller produktet og prisgrunnlaget mot avtalen med bedriften.",
			"Se om salget bruker en lagret pris eller dagens katalog. Ikke anta at en katalogendring oppdaterer en tidligere avtale.",
			"Bruk produktmerking for historiske salg når koblingen mangler. Kontroller valget før du lagrer.",
			"Når du leser salgsstatistikk, kontroller periode, kategorier og hvordan sponsorer behandles.",
		],
		automatic:
			"Produktkoblinger brukes i salgsoversikter og fakturagrunnlag. Lagrede øyeblikksbilder bevarer tidligere opplysninger.",
		verify: "Bedrift, produkt, beløp og fakturagrunnlag samsvarer med avtalen.",
		recovery:
			"Ved avvik, avklar med økonomiansvarlig og dokumenter korrigeringen i den relevante flyten.",
		related: ["produkter", "fakturering"],
	}),
	guide({
		slug: "fakturering",
		title: "Opprette faktura i Fiken og følge opp i Bifrost",
		category: "finance",
		excerpt:
			"Bifrost holder oversikten over fakturagrunnlaget. Du oppretter og sender selve fakturaen i Fiken.",
		aliases: ["faktura", "fakturering", "Fiken", "invoice", "EHF"],
		owner: "Økonomiansvarlig",
		before: `Åpne ${app("/invoicing", "Fakturaer")}. Kontroller at leveransen og grunnlaget er klart for fakturering.`,
		steps: [
			"Åpne posten og kontroller bedrift, organisasjonsnummer, adresse eller EHF, produkt, beløp, dato og eventuelle kommentarer.",
			"Opprett og send fakturaen i Fiken med det avklarte grunnlaget.",
			"Gå tilbake til Bifrost og marker fakturaen som sendt først når den faktisk er sendt.",
			"Bruk gjenåpning eller kansellering når en post trenger oppfølging. Kontroller hva som allerede er sendt før du gjør endringen.",
		],
		automatic:
			"Bifrost oppretter og følger fakturagrunnlag fra relevante bestillinger og søknader. Informasjonen ved sending bevares som et øyeblikksbilde.",
		verify:
			"Fakturaen finnes og er sendt i Fiken. Bifrost har tilsvarende status og riktig grunnlag. En statusendring i Bifrost sender ikke fakturaen i Fiken.",
		recovery:
			"Ikke send en ny faktura bare fordi status er uklar. Kontroller Fiken først. Gjenåpning eller kansellering i Bifrost erstatter ikke nødvendig regnskapsmessig oppfølging i Fiken.",
		related: ["produkter", "salg-priser", "annonsebestilling"],
	}),
	guide({
		slug: "utlegg",
		title: "Levere kvitteringer og utlegg",
		category: "finance",
		excerpt: "Samle dokumentasjon for personlige utlegg og kjøp med Navet-kortet.",
		aliases: ["kvittering", "refusjon", "Navet-kort"],
		owner: "Økonomiansvarlig",
		before: "Samle kvitteringer og opplysninger om arrangementet og hva kjøpet gjaldt.",
		steps: [
			"Ta vare på kvitteringen ved hvert kjøp, også med Navet-kortet.",
			`Bruk ${app(EVENT_EXPENSE_TEMPLATE_URL, "gjeldende utleggsmal")} og fyll inn opplysningene for kjøpet.`,
			"Lever dokumentasjonen gjennom rutinen økonomiansvarlig bruker. Avklar manglende kvitteringer direkte.",
			"Kryss av utlegg i arrangementets sjekkliste når dokumentasjonen er levert.",
		],
		automatic:
			"Slack kan minne deg på utlegg etter arrangementet. Det finnes ikke en komplett digital utleggsbehandling i Bifrost ennå.",
		verify:
			"Økonomiansvarlig har mottatt nødvendig dokumentasjon. Avkrysning i Bifrost alene betyr ikke at et utlegg er refundert.",
		recovery:
			"Kontakt økonomiansvarlig ved feil eller manglende dokumentasjon. Behold originalen til saken er avklart.",
		related: ["sjekkliste", "praktisk-arrangement"],
	}),
	guide({
		slug: "opptaksperiode",
		title: "Opprette og følge en opptaksperiode",
		category: "members",
		excerpt: "Samle søknader og forbered intervjuarbeidet i én opptaksperiode.",
		aliases: ["opptakssystem", "søknader", "rekruttering"],
		owner: "Opptaksansvarlig",
		before: `Åpne ${app("/admissions", "Opptak")}. Avklar frister, aktuelle verv og hvordan intervjuene skal gjennomføres.`,
		steps: [
			"Opprett eller åpne riktig opptaksperiode. Kontroller innstillinger og informasjon som søkerne skal se.",
			"Følg søknadene i perioden og kontroller at de er klare for behandling.",
			"Sett opp intervjutilgjengelighet og gå videre til planlegging når søknadsgrunnlaget er klart.",
			"Avslutt eller skjul ferdige perioder gjennom opptaksflyten når oppfølgingen er ferdig.",
		],
		automatic:
			"Søknader og videre behandling knyttes til perioden. Systemets avslutnings- og lagringsrutiner håndterer ferdige perioder.",
		verify: "Du jobber i riktig periode, og alle aktuelle søknader er med i behandlingen.",
		recovery:
			"Kontroller periodevalg og synlighet hvis søknader ser ut til å mangle. Avklar før du oppretter en ny periode for samme opptak.",
		related: ["intervjuer", "opptaksbeslutninger"],
	}),
	guide({
		slug: "intervjuer",
		title: "Planlegge og publisere intervjuer",
		category: "members",
		excerpt: "Samle tilgjengelighet, vurder timeplanen og godkjenn før varsler sendes.",
		aliases: ["intervju", "kalender", "tilgjengelighet"],
		owner: "Opptaksansvarlig",
		before: "Åpne opptaksperioden. Avklar intervjutider, deltakere og kalenderoppsett.",
		steps: [
			"Registrer tilgjengelighet for intervjuerne og kontroller kalendergrunnlaget.",
			"Lag et forslag til intervjutider. Se gjennom konflikter, bemanning og søkerne som skal inviteres.",
			"Godkjenn og publiser planen når den er klar. Dette er steget som utløser varsling og kalenderoppfølging.",
			"Åpne kandidaten under intervjuet og før relevante notater i riktig kandidatvisning.",
		],
		automatic:
			"Et godkjent oppsett kan sende epost, kalenderinvitasjoner og Slack-varsler. Et forslag alene er ikke en sendt invitasjon.",
		verify: "Intervjuene har riktig tidspunkt og deltakere, og utsendingene er kontrollert.",
		recovery:
			"Rett planen gjennom opptaksflyten. Kontroller eksisterende kalenderinvitasjon og leveringsstatus før du sender en ekstra invitasjon manuelt.",
		related: ["opptaksperiode", "opptaksbeslutninger", "epost-feilsoking"],
	}),
	guide({
		slug: "opptaksbeslutninger",
		title: "Velge kandidater og sende beslutninger",
		category: "members",
		excerpt: "Gjør vurderingen ferdig før tilbud og avslag sendes til søkerne.",
		aliases: ["tilbud", "avslag", "kandidat", "utvelgelse"],
		owner: "Opptaksansvarlig",
		before:
			"Kontroller at intervjuene og relevante notater er ferdige. Avklar hvem som skal få tilbud.",
		steps: [
			"Gå gjennom kandidatene og utvelgelsesrundene i riktig periode.",
			"Kontroller beslutningen for hver kandidat og hvilke verv tilbudene gjelder.",
			"Send beslutningene gjennom den egne sendefunksjonen når gjennomgangen er ferdig.",
			"Følg svarene på tilbudene og kontroller onboarding for kandidater som takker ja.",
		],
		automatic:
			"Sendefunksjonen håndterer beslutningsepostene. Aksepterte tilbud kan starte medlemsopprettelse og kontoarbeid.",
		verify:
			"Alle aktuelle kandidater har en korrekt beslutning og leveringsstatus. De som har takket ja, følges videre i Organisasjon.",
		recovery:
			"Stopp videre utsending og avklar en feil beslutning før du sender korrigering. Kontroller status på kandidaten og kontoen ved manglende onboarding.",
		related: ["intervjuer", "medlemskontoer"],
	}),
	guide({
		slug: "medlemskontoer",
		title: "Opprette og avslutte medlemskontoer",
		category: "members",
		excerpt: "Følg Google-konto, Bifrost-tilgang og Slack gjennom hele medlemskapet.",
		aliases: ["IAM", "provisioning", "onboarding", "offboarding", "Google Workspace"],
		owner: "Medlemsansvarlig",
		before: `Åpne ${app("/organization", "Organisasjon")}. Kontroller navn, UiO-adresse, Navet-adresse og medlemsopplysninger.`,
		steps: [
			"Legg til medlemmet eller følg kontoen som ble startet fra akseptert opptakstilbud.",
			"Kontroller fremdriften for Google-konto og velkomstmelding. Medlemmet følger velkomstflyten og logger inn.",
			"Hjelp medlemmet med Slack-invitasjonen ved behov. Kontroller aktiveringen i Organisasjon.",
			"Ved fratreden: start avslutning i Organisasjon. Følg Google-suspendering og bortfall av Bifrost-tilgang. Deaktiver Slack-medlemskapet manuelt og bekreft at det er gjort.",
		],
		automatic:
			"Kontoopprettelse, velkomstmelding og deler av aktiveringen koordineres av systemet. Offboarding suspenderer Google-kontoen og fjerner tilgangen i Bifrost.",
		verify:
			"Medlemsstatus og kontostatus samsvarer. Ved avslutning er også den manuelle Slack-oppgaven fullført.",
		recovery:
			"Se hvilken deloperasjon som feilet. Bruk tilgjengelig retry eller avbryt i kontoflyten etter at årsaken er rettet. Ikke opprett en ekstra konto for samme person.",
		related: ["kontosynk", "opptaksbeslutninger", "epost-feilsoking"],
	}),
	guide({
		slug: "kontosynk",
		title: "Undersøke avvik i kontosynkronisering",
		category: "members",
		excerpt: "Sammenlign medlemskapet med Google og Slack og følg opp konkrete avvik.",
		aliases: ["IAM syncing", "synk", "reconcile", "Google", "Slack tilgang"],
		owner: "Medlemsansvarlig",
		before: "Åpne Organisasjon og den aktuelle kontoen. Kontroller hva medlemsstatusen skal være.",
		steps: [
			"Les kontostatus, siste operasjoner og eventuelle avvik.",
			"Bruk kontrollfunksjonen for en oppdatert sammenligning når den er tilgjengelig.",
			"Rett årsaken til avviket i riktig system eller gjennom kontoflyten. Kontroller epostadressene nøye.",
			"Følg opp en feilet operasjon med retry når forutsetningene er rettet.",
		],
		automatic:
			"En nattlig jobb sammenligner registrerte kontoer og medlemskap med Google og Slack. Avvik gir oppfølging, ikke en garanti for at enhver ekstern endring blir rettet automatisk.",
		verify: "Kontostatus og ekstern tilgang samsvarer med medlemskapet, og avviket er avklart.",
		recovery:
			"Eskaler med kontoens status og feilmelding hvis kontrollen feiler. Del aldri passord eller invitasjonstokener i håndboken.",
		related: ["medlemskontoer", "slack-varsler"],
	}),
	guide({
		slug: "prognoser",
		title: "Bruke prognoser og varsler i Innsikt",
		category: "insight",
		excerpt: "Vurder forventet påmelding og følg opp konkrete signaler før arrangementet.",
		aliases: ["engagement", "prognose", "varsler", "avmeldinger"],
		before: `Åpne ${app("/insight", "Innsikt")} og velg et kommende arrangement.`,
		steps: [
			"Se på påmeldingskurven og prognosen. Sammenlign med typiske forløp og vurder kapasiteten.",
			"Bytt arrangement for å se riktig målgruppe og kurve.",
			"Undersøk varsler om mange avmeldinger eller ingen påmeldinger. Åpne arrangementet for å vurdere tiltak.",
			"Avklar promotering med PR-ansvarlig. Bruk prognosen som beslutningsstøtte sammen med kjennskap til arrangementet.",
		],
		automatic:
			"Statistikk og prognosegrunnlag oppdateres fra registreringer og historiske arrangementer. Tilgjengelig datagrunnlag påvirker hvilke prognoser som kan vises.",
		verify:
			"Du forstår hva varselet gjelder og har avtalt eventuell oppfølging. Et varsel kan skjules når det er behandlet.",
		recovery:
			"Manglende prognose kan skyldes lite sammenlignbart grunnlag. Kontroller det konkrete arrangementet og registreringene før du konkluderer.",
		related: ["sammenligne-innsikt", "sjekkliste"],
	}),
	guide({
		slug: "sammenligne-innsikt",
		title: "Sammenligne semestre, bedrifter og mat",
		category: "insight",
		excerpt: "Bruk gjennomførte arrangementer til å planlegge bedre neste gang.",
		aliases: ["statistikk", "oppmøte", "historikk", "matinnsikt"],
		before: "Åpne Innsikt og velg relevant fane og periode.",
		steps: [
			"Bruk tidligere arrangementer til å se oppmøte, avmeldinger og forløp.",
			"Sammenlign semestre eller bedrifter med tilsvarende datagrunnlag. Kontroller valgt tidsperiode.",
			"Se matvisningen for erfaringer knyttet til registrert servering. Skill datagrunnlag fra egne vurderinger.",
			"Åpne arrangementet eller bedriftsrapporten når du trenger detaljene bak et tall.",
		],
		automatic:
			"Innsikt samler registrerte data og beregnede sammenligninger. Matinnsikt kan være tilgjengelig selv om separat matadministrasjon er under utprøving.",
		verify:
			"Sammenligningen bruker riktig periode og kjente data. Fravær av historikk i en visning betyr ikke at all eldre aktivitet mangler.",
		recovery:
			"Rett feil i oppmøte, mat eller bedriftskobling ved kilden. Meld fra om vedvarende avvik i statistikken.",
		related: ["prognoser", "bedriftshistorikk", "oppmote-prikker"],
	}),
	guide({
		slug: "leaderboard",
		title: "Lese leaderboardet",
		category: "insight",
		excerpt: "Se den interne oversikten og forstå hvilken aktivitet den bygger på.",
		aliases: ["toppliste", "rangering"],
		before: `Åpne ${app("/leaderboard", "Leaderboard")}.`,
		steps: [
			"Kontroller perioden og hva oversikten måler før du sammenligner plasseringer.",
			"Se aktiviteten bak plasseringen og kontroller registreringen ved kilden hvis noe ser feil ut.",
			"Bruk oversikten som en aktivitetsoversikt sammen med den øvrige oppfølgingen av arrangementer.",
		],
		automatic: "Rangeringen beregnes fra aktiviteten som systemet har registrert.",
		verify: "Du leser riktig periode og har forstått målet som vises.",
		recovery:
			"Kontroller ansvarstildeling og aktivitet på de relevante arrangementene ved manglende uttelling.",
		related: ["sjekkliste", "sammenligne-innsikt"],
	}),
	guide({
		slug: "lage-skjema",
		title: "Lage og publisere tilbakemeldingsskjemaer",
		category: "tools",
		excerpt: "Bygg spørsmål, publiser en versjon og velg skjemaet for arrangementene.",
		aliases: ["skjemaer", "skjemabygger", "survey", "form", "spørsmål"],
		before: `Åpne ${app("/feedback-forms", "Skjemaer")}. Bestem hvilke spørsmål arrangementet trenger.`,
		steps: [
			"Opprett et skjema eller rediger et eksisterende utkast. Legg inn spørsmål av støttede typer, svaralternativer og hva som er påkrevd.",
			"Kontroller rekkefølge, ordlyd og forhåndsvisning. Publiser en versjon når spørsmålene er klare.",
			"Velg standardskjema eller knytt et skjema til et konkret arrangement. Bruk testsending for å kontrollere opplevelsen.",
			"Lag en ny versjon for senere endringer. Skjul skjemaer som ikke lenger skal velges.",
		],
		automatic:
			"Publiserte versjoner bevares. Arrangementets versjon låses når utsendingen er i gang, slik at svar kan tolkes mot riktige spørsmål.",
		verify:
			"Det finnes en publisert versjon, og arrangementet bruker riktig skjema. Denne skjemabyggeren er for tilbakemeldinger, ikke alle typer vilkårlige skjemaer.",
		recovery:
			"Hvis endring er låst, undersøk om utsending har startet. Lag en ny versjon for fremtidig bruk i stedet for å endre betydningen av innsamlede svar.",
		facts: ["forms"],
		related: ["tilbakemeldinger", "bestillingsskjema"],
	}),
	guide({
		slug: "bestillingsskjema",
		title: "Vedlikeholde annonsebestillingsskjemaet",
		category: "tools",
		excerpt: "Kontroller informasjonen bedriftene møter når de bestiller en stillingsannonse.",
		aliases: ["annonse skjema", "bestillingsinnstillinger"],
		before:
			"Åpne innstillingene for stillingsannonsebestillinger fra Skjemaer. Avklar endringer i produkter og vilkår før du publiserer dem.",
		steps: [
			"Les eksisterende bestillingsinformasjon og tilgjengelige innstillinger.",
			"Oppdater relevant tekst og kontroller hvilke produkter bedriften kan velge.",
			"Se gjennom den offentlige bestillingsflyten og kontroller at kontakt- og fakturainformasjonen etterspørres riktig.",
		],
		automatic:
			"Bestillinger går til behandlingsoversikten og sender mottaksbekreftelse gjennom den etablerte flyten.",
		verify:
			"Bedriften får tydelig informasjon, og en innsendt bestilling kan behandles med riktig produkt og fakturagrunnlag.",
		recovery:
			"Kontroller produktkatalogen dersom feil valg eller pris vises. Ikke bruk tilbakemeldingsskjemaet som erstatning for annonsebestilling.",
		related: ["annonsebestilling", "produkter"],
	}),
	guide({
		slug: "slack-varsler",
		title: "Forstå Navet-bottens varsler",
		category: "tools",
		excerpt: "Se hva botten følger opp, når den minner deg på noe og hvor du løser oppgaven.",
		aliases: ["Slack bot", "Navet bot", "purring", "påminnelser", "bedriftskanal"],
		before:
			"Åpne varselets lenke til Bifrost og kontroller hvilket arrangement eller hvilken konto det gjelder.",
		steps: [
			"Les oppgaven og følg lenken. Bedriftsarbeid samles i en privat kanal for bedriften og semesteret.",
			"Fullfør oppgaven i Bifrost, for eksempel sjekklisten, oppmøtet eller rapportgodkjenningen. Et svar i Slack endrer ikke nødvendigvis statusen i Bifrost.",
			"Kontroller status på utsendinger før du behandler et varsel som løst.",
			"Ved manglende tilgang til kanalen, kontroller ansvarstildeling og kontosynkronisering.",
		],
		automatic:
			"Botten oppretter og vedlikeholder bedriftskanaler, inviterer aktuelle medlemmer og følger opp relevante oppgaver. Ferdige kanaler kan arkiveres etter at alt etterarbeid er fullført.",
		verify: "Oppgaven er løst i kildesystemet, og videre varsler samsvarer med statusen.",
		recovery:
			"Ved gjentatte varsler, kontroller uferdige registreringer eller leveringsstatus. Meld fra med lenke til oppgaven hvis statusen allerede er korrekt.",
		facts: ["slack"],
		related: ["paminnelse-epost", "bedriftsrapport", "kontosynk"],
	}),
	guide({
		slug: "offentlige-sider",
		title: "Oppdatere offentlige sider",
		category: "tools",
		excerpt:
			"Rediger innholdet som vises offentlig, og hold det adskilt fra den interne håndboken.",
		aliases: ["Midgard", "nettside", "innhold"],
		before: `Åpne ${app("/pages", "Sider")}. Kontroller hvilken offentlig side som skal oppdateres.`,
		steps: [
			"Åpne siden og rediger tittel og innhold. Hold intern informasjon i håndboken.",
			"Se gjennom lenker, overskrifter og tekst før du publiserer.",
			"Kontroller den offentlige nettsiden etter lagring, også på en smal skjerm.",
		],
		automatic:
			"Publisert sideinnhold hentes fra Bifrost. Offentlige sider har sin egen lagring og blir ikke flyttet inn i håndboken.",
		verify: "Riktig innhold vises offentlig, og lenkene fører til riktige sider.",
		recovery:
			"Hvis adressen endres ved tittelendring, kontroller eksisterende lenker og avklar nødvendig oppdatering.",
		related: ["oppdatere-handboken"],
	}),
	guide({
		slug: "epost-feilsoking",
		title: "Undersøke bekreftelser og epostlevering",
		category: "tools",
		excerpt: "Skill mellom klargjort, sendt, levert og feilet før du prøver igjen.",
		aliases: ["epost", "email", "bekreftelseslenke", "bounce", "retry"],
		before:
			"Åpne den konkrete søknaden, kontoen eller utsendingen. Ha mottakeradresse og feilmelding tilgjengelig.",
		steps: [
			"Kontroller adressen og hvilken handling som skulle sende eposten. Noen flyter krever godkjenning før sending.",
			"Les leveringsstatus. En epost i kø er ikke nødvendigvis levert, og en levert epost er ikke nødvendigvis lest.",
			"Be mottakeren undersøke søppelpost ved behov. Bruk funksjonen for ny bekreftelseslenke dersom lenken er utløpt.",
			"Rett adressen eller årsaken til feilen gjennom den relevante flyten, og bruk støttet ny sending.",
		],
		automatic:
			"Systemet sporer støttede leveringer og håndterer deler av gjenopprettingen. Nye lenker kan ugyldiggjøre tidligere lenker.",
		verify:
			"Riktig mottaker har en gyldig lenke, og statusen i Bifrost stemmer med videre handling.",
		recovery:
			"Eskaler med tidspunkt, funksjon og feilmelding hvis problemet vedvarer. Ikke kopier private lenker, passord eller tokener inn i håndboken.",
		related: ["bedriftssoknader", "paminnelse-epost", "medlemskontoer"],
	}),
];
