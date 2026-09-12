---
name: efactura-integration
description: How the SIA e-Factura (SFS Moldova) boundary is structured and what implementing the real provider requires. Use when touching src/modules/efactura or anything about submitting, signing or reconciling documents with the tax platform.
---

# The e-Factura boundary

## Shape

```
modules/efactura/
├── providers/
│   ├── efactura-provider.ts          the interface — everything else depends on this
│   ├── sandbox-efactura.provider.ts  in-memory, used by development and CI
│   └── sfs-efactura.provider.ts      the real integration
├── model/
│   └── error-catalogue.ts            platform codes turned into human sentences
└── efactura.module.ts                the one factory that picks an implementation
```

`EFACTURA_PROVIDER=sandbox|sfs` decides which is bound. No other file knows there
is a choice. The config validator refuses to start with `sandbox` in production.

## Before writing the real provider

Two things cannot be guessed and must exist first:

1. An **API user** created inside SIA "e-Factura". It is a role the company
   creates itself in the system, not something negotiated with the tax service.
2. The current **"Ghid de integrare — API"** from the **Help section, top right
   of the e-Factura system**. The semi-automated and fully automated flows
   differ, and the field names are not inferable from outside.

A qualified electronic signature certificate is also needed; signing in the
fully automated flow happens on our side.

The full access procedure, the volume threshold above which STISC's PKI-Server
signing service becomes relevant, and the CTIF support number are in the
`efactura-standard` skill.

**Do not fill in endpoints from assumption.** A document assembled from a guess
is rejected by the platform's validator, and the rejection surfaces at the
customer weeks later, not in a test.

## Rules for the implementation

- **Every attempt is stored whole.** One `EfacturaSubmission` row per attempt,
  with the request XML and the raw response. When the platform disputes what was
  sent, this is the evidence.
- **Retries are bounded and backed off.** A platform outage is `retryable: true`
  in the catalogue and leaves the invoice queued, not failed. A rejected document
  is not retryable and must not be resubmitted unchanged.
- **Totals are computed by `model/invoice-totals.ts` and nowhere else.** Lines
  are rounded before summation; a one-ban difference from the validator's own
  arithmetic rejects the whole document.
- **Status changes go through `model/invoice-status.ts`.** An invoice that is
  ACCEPTED is final; there is no path out of it.

## The error catalogue is the product

`model/error-catalogue.ts` maps a platform code to a sentence in Romanian and
Russian, the field to focus, and whether retrying could help. This is the
difference between Facturo and the state portal, which answers with a code.

Add entries **as the test environment produces them**. An invented code is worse
than the honest fallback, which says the response was saved and is being looked
at.

## Related government services

`MPass` (single sign-on), `MSign` (electronic signature) and `MConnect`
(interoperability between registries) are separate integrations with their own
enrolment. Do not assume e-Factura access implies any of them.
