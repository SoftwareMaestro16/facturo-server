---
name: efactura-standard
description: What SIA "e-Factura" (State Tax Service of Moldova) actually requires — the two lifecycles, the statuses, the roles, the mandatory fields, the issue-date rules, cancellation, formats and penalties. Use before writing anything that produces, sends, signs or interprets a fiscal document.
---

# The e-Factura standard

Everything here is grounded in published sources, listed at the bottom. Where a
detail is not established, it says so rather than guessing. **Do not fill gaps
from assumption.** A document assembled from a guess is refused by the
platform's validator, and the refusal surfaces at the customer weeks later.

## The mandate

- SIA "e-Factura" is the State Tax Service's system for issuing and receiving
  electronic fiscal invoices. Voluntary since 2014, mandatory for B2G since
  2023.
- **Mandatory for domestic B2B from 1 October 2026**, after a pilot phase that
  began in January 2026.
- An invoice issued on paper where the electronic form is required attracts a
  fine of **25–35% of the transaction value**, and may **lose the VAT deduction
  entirely**. The deduction loss is the one that actually hurts, because it
  surfaces at reconciliation months later.
- Fiscal documents must be retained for **six years**.
- Moldova is connecting to **Peppol** for cross-border exchange. Domestic
  documents go through e-Factura, not Peppol.

## The two lifecycles

The supplier chooses one when issuing. They differ in whose signature finishes
the document.

**Short cycle — "ciclu scurt".** The document reaches the final state
("Finisată") when the **supplier applies a second signature**. The supplier then
prints it, signs by hand and hands the paper to the buyer. This exists for
buyers who are not in the system.

**Long cycle — "ciclu lung".** The document reaches the final state when the
**buyer signs it electronically**. It never leaves the system and nothing is
printed. This is the cycle that matters after the mandate, and the one Facturo
defaults to.

When all three parties — supplier, buyer and transporter — or at least supplier
and buyer are registered in the system, the whole circulation stays electronic.

## Statuses

| Platform term | In code | Meaning |
|---|---|---|
| Nouă | `DRAFT` | Exists only in Facturo, still editable |
| Semnată | `SIGNED` | The supplier's first signature is applied |
| Expediată | `SENT` | Handed to the platform, visible to the buyer |
| Recepționată | `RECEIVED` | The buyer has taken delivery in the system |
| Finisată | `FINISHED` | Final. Short cycle: supplier's second signature. Long cycle: buyer's signature |
| — | `CANCELLATION_REQUESTED` | The supplier asked to cancel a finished long-cycle document, waiting on the buyer |
| Anulată | `CANCELLED` | Cancelled |
| — | `ERROR` | Ours, not the platform's: the exchange failed |

The transition table lives in `src/modules/invoices/model/invoice-status.ts` and
is per cycle. Do not add a shortcut to it without a source.

## Cancellation

A document that reached "Finisată" through the **long cycle** carries the
buyer's signature. The supplier **cannot withdraw it alone**: cancellation
requires the buyer's electronic acceptance inside the system. In the short cycle
the buyer never signed there, so the supplier may cancel directly.

This is why `CANCELLATION_REQUESTED` exists. The interface must be honest about
it: "we asked the buyer", not "cancelled".

## Issue date — the rule that costs customers money

Three rules, enforced in `src/modules/invoices/model/issue-date.ts`:

1. On creation, the issue date may be **today or up to ten calendar days
   ahead**. Nothing earlier.
2. When an electronic signature is applied, the issue date **must not be in the
   past** relative to the signing date. This holds for documents created in the
   portal, uploaded as XML, and sent through the API alike.
3. If the **second signature** lands on a day after the issue date, the document
   can no longer be completed. The only remaining action is cancellation, and a
   new document has to be issued.

Rule 3 is the expensive one. A document drafted on Friday and signed off on
Monday is dead. **Facturo must warn before the click, not after** — that warning
is a large part of why someone would pay for this instead of using the portal.

## Roles

**Furnizor** (supplier), **Cumpărător** (buyer), **Transportator**
(transporter). The transporter is a real participant for goods, not a free-text
note.

## Mandatory content

The form is the standardised primary document with special regime "Factură
fiscală", governed by Order of the Ministry of Finance **OMF 118/2017**.
Established points:

- **Series and number are assigned by the State Tax Service**, not chosen by the
  issuer. Facturo's own `series`/`number` are draft numbering; the fiscal ones
  come back from the platform and are stored separately.
- **Fiscal code (IDNO)** is mandatory for both supplier and buyer.
- **Row 5, "Punctul de încărcare"** — the address where goods are first loaded
  onto the transport unit.
- **Row 6, "Punctul de descărcare"** — the unloading address. When goods are
  redirected, the original address is struck out and the new one written in.
- **Unitatea de măsură** — unit of measure, per the national classifier, on
  every line.

The exact XML element names are **not** reproduced here, because the import
schema is published inside the system's own Help section and changes with
versions. Take it from there, not from this file.

## Formats and integration

The platform accepts and produces **XML**, **XLS** and **API**. Import schemas
for each document type, and the API specification, live in the **"Help" section
of SIA e-Factura** at `efactura.sfs.md`.

Two integration modes:

- **Semi-automated** — documents are recorded in the accounting system and sent
  to e-Factura, then signed through the `servicii.fisc.md` portal. Intended for
  low volumes.
- **Fully automated** — documents are registered, signed and sent without
  touching the portal. This is what Facturo implements.

The State Tax Service explicitly recommends API integration for taxpayers
issuing many invoices daily.

## What is needed before writing `SfsEfacturaProvider`

1. A signed integration agreement with the State Tax Service, with test
   environment access and credentials.
2. The current **"Ghid de integrare — API"** from the Help section of the
   system. Also the semi-automated guide, to understand the other mode.
3. A **qualified electronic signature certificate**. In the fully automated mode
   signing happens on our side.

Related but separate government services, each with its own enrolment:
**MPass** (single sign-on), **MSign** (electronic signature),
**MConnect** (data exchange between state registries). Access to e-Factura does
not imply access to any of them.

## Sources

- State Tax Service, e-Factura: <https://efactura.sfs.md>, <https://sfs.md>
- SFS Order OSFS 317/2020 — e-Factura regulation, lifecycles and statuses
- Ministry of Finance Order OMF 118/2017 — the fiscal invoice form and its
  completion instructions
- "Ghid de utilizare a SIA e-Factura" and "Manual de operare v3.0", published
  via egov.md and monitorul.fisc.md
- Centrul de Tehnologii Informaționale în Finanțe (ctif.gov.md) on integrating
  accounting systems with the current version of e-Factura

Several of these are PDFs on government domains. Read them directly before
implementing; this file is a summary, not a substitute.
