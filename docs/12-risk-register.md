# Registro Rischi / Risk Register

## Italiano

### Scopo

Questo registro elenca i principali rischi tecnici, metodologici e organizzativi oggi visibili nel progetto. Non sostituisce una governance completa, ma fornisce un quadro prioritario per evitare che la crescita del sistema comprometta la qualita scientifica.

### Rischi principali

#### R1. Incoerenza sperimentale

Descrizione:
benchmark eseguiti con prompt, modelli o dati non pienamente tracciati possono generare risultati non confrontabili.

Impatto:
alto

Mitigazione:
versionamento di prompt, snapshot dataset, registro campagne sperimentali.

#### R2. Concorrenza benchmark limitata

Descrizione:
la cancellazione globale dei benchmark e il modello di esecuzione in background non sono progettati per uso multi-utente robusto.

Impatto:
alto

Mitigazione:
job queue dedicata, controllo per batch, isolamento per utente o sessione.

#### R3. Sicurezza applicativa insufficiente

Descrizione:
assenza di autenticazione, autorizzazione e policy di accesso strutturate.

Impatto:
alto

Mitigazione:
introduzione di identity layer, ruoli, audit e hardening CORS.

#### R4. Perdita dati o distruzione involontaria

Descrizione:
alcuni workflow distruttivi su datastore o reset schema possono compromettere dati sperimentali.

Impatto:
alto

Mitigazione:
backup, soft-delete, conferme esplicite, migrazioni formali, test di restore.

#### R5. Affidabilita limitata delle metriche

Descrizione:
la similarita semantica puo essere utile ma non sufficiente a rappresentare correttezza clinica.

Impatto:
medio-alto

Mitigazione:
validazione incrociata con rating umani e rubriche cliniche.

## English

### Purpose

This register lists the main technical, methodological, and organizational risks currently visible in the project. It does not replace full governance, but it provides a priority picture to prevent system growth from undermining scientific quality.

### Main risks

#### R1. Experimental inconsistency

Description:
benchmarks executed with poorly tracked prompts, models, or data can produce non-comparable results.

Impact:
high

Mitigation:
prompt versioning, dataset snapshots, experiment registry.

#### R2. Limited benchmark concurrency model

Description:
global benchmark cancellation and background execution are not designed for robust multi-user operation.

Impact:
high

Mitigation:
dedicated job queue, per-batch control, user or session isolation.

#### R3. Insufficient application security

Description:
lack of authentication, authorization, and structured access control.

Impact:
high

Mitigation:
introduce identity layer, roles, audit, and stronger CORS policy.

#### R4. Data loss or accidental destructive behavior

Description:
some destructive datastore or schema reset workflows can compromise experimental data.

Impact:
high

Mitigation:
backups, soft-delete, explicit confirmation, formal migrations, restore testing.

#### R5. Limited reliability of automatic metrics

Description:
semantic similarity may be useful but not sufficient to represent clinical correctness.

Impact:
medium-high

Mitigation:
cross-validation with human ratings and clinical rubrics.

