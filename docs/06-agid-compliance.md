# Conformita AGID / AGID Compliance Notes

## Italiano

### Premessa

Questo documento non costituisce parere legale. Serve a mappare il progetto rispetto ad alcune aspettative tipiche di interoperabilita, accessibilita, sicurezza, tracciabilita e governance che diventano rilevanti quando una piattaforma software si avvicina a contesti pubblici o sanitari.

### Stato attuale

LLMind2 non puo essere considerato conforme AGID nello stato attuale. Puo pero essere considerato un buon punto di partenza tecnico, a condizione di distinguere con chiarezza tra:

- stato presente della piattaforma
- direzione di evoluzione verso allineamento normativo e organizzativo

### Aree rilevanti

#### Accessibilita

La UI e moderna e abbastanza strutturata, ma non risultano evidenze di audit sistematico rispetto ai requisiti di accessibilita. Per un allineamento serio servirebbero:

- verifica semantica dei componenti
- navigazione completa da tastiera
- controllo contrasto e leggibilita
- audit con screen reader

#### Sicurezza applicativa

Esistono basi corrette, come la configurazione tramite environment variables, ma mancano elementi essenziali:

- autenticazione utenti
- autorizzazione per ruoli
- restrizione CORS in produzione
- segregazione dei dati per identita o dominio d'uso

#### Protezione dei dati

Il progetto tratta contenuti clinici e quindi deve essere progettato come sistema ad alta sensibilita informativa, anche se usato in ricerca. Serve quindi definire:

- finalita del trattamento
- basi giuridiche se applicabile
- tempi di conservazione
- procedure di cancellazione
- misure di cifratura e protezione del trasporto

#### Tracciabilita e audit

I log applicativi e la persistenza dei run sono un buon inizio, ma non bastano. Sarebbe necessario poter ricostruire:

- chi ha avviato un benchmark
- con quale configurazione
- su quali dati
- con quale modello
- con quale esito

#### Interoperabilita e portabilita

Qui il progetto parte meglio di quanto spesso accada nei prototipi:

- uso di Docker
- configurazione tramite env
- servizi separati
- endpoint API chiari

Questi elementi aiutano molto in una prospettiva AGID-oriented, perche riducono il lock-in tecnico e semplificano la documentazione di esercizio.

### Piano minimo di avvicinamento

Per iniziare un percorso credibile verso maggiore conformita, bisognerebbe:

1. introdurre autenticazione e profili
2. documentare policy di dati e retention
3. aggiungere audit trail degli eventi sensibili
4. eseguire una valutazione accessibilita
5. restringere CORS e formalizzare il deploy sicuro

## English

### Premise

This document is not legal advice. Its purpose is to map the project against common expectations that become relevant when software approaches public-sector or health-related contexts, especially regarding interoperability, accessibility, security, traceability, and governance.

### Current status

LLMind2 should not be considered AGID-compliant in its current state. It can, however, be considered a technically promising starting point, provided that a clear distinction is maintained between:

- the present state of the platform
- the future direction toward regulatory and organizational alignment

### Relevant areas

#### Accessibility

The UI is modern and fairly structured, but there is no visible evidence of systematic accessibility auditing. Serious alignment would require:

- semantic component verification
- full keyboard navigation
- contrast and readability validation
- screen-reader testing

#### Application security

There are some good foundations, such as environment-driven configuration, but essential controls are missing:

- user authentication
- role-based authorization
- restricted production CORS
- data segregation by identity or usage domain

#### Data protection

The project handles clinical content and should therefore be treated as a high-sensitivity information system, even in research settings. This requires clearer definition of:

- processing purposes
- legal basis where applicable
- retention periods
- deletion procedures
- encryption and transport protection measures

#### Traceability and audit

Application logs and persisted benchmark runs are a useful start, but not enough. The system should make it possible to reconstruct:

- who launched a benchmark
- with which configuration
- on which data
- with which model
- and with what outcome

#### Interoperability and portability

This is an area where the project starts from a stronger position than many prototypes:

- Docker-based packaging
- environment-driven configuration
- separated services
- explicit API endpoints

These properties are helpful for AGID-oriented evolution because they reduce technical lock-in and simplify operational documentation.

### Minimal path toward stronger alignment

To begin a credible compliance-oriented path, the project should:

1. introduce authentication and profiles
2. document data and retention policies
3. add audit trails for sensitive events
4. perform accessibility assessment
5. tighten CORS and formalize secure deployment

