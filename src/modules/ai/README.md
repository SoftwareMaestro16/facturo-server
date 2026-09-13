# AI assistant

## What is wired

`POST /api/ai/invoice-draft` turns a short description of a sale ("2 hours of
consulting at 500 for Atelier Nord") into a proposal for the invoice form. It
saves nothing and sends nothing: the person reviews the form and saves the
invoice through the normal invoices endpoint.

- **Off by default.** `Company.aiEnabledAt` is null until the owner turns it on
  (`PUT /api/ai/settings`, OWNER only). The timestamp and `aiEnabledByUserId`
  are the record of that decision.
- **What leaves the server:** the typed text and the company's own catalogue
  (up to 100 product names, net prices, VAT rates). Never the buyer directory,
  documents, bank details or identity data. Buyers are matched on the server
  (`model/matching.ts`).
- **Provider boundary:** `providers/ai-provider.ts`. `AI_PROVIDER=sandbox` uses a
  local heuristic and sends nothing anywhere; `AI_PROVIDER=openai` calls the
  Responses API with `store: false`, a strict JSON schema, a timeout and a
  bounded output. Boot refuses `openai` without `OPENAI_API_KEY` in production,
  and the sandbox is reported as unavailable in production.
- **Untrusted output:** `model/invoice-draft.ts` re-checks every field — lengths,
  decimal formats, the VAT rate list, the line cap — and converts VAT-inclusive
  prices to net in integer minor units. A prompt injection can at worst produce
  a wrong proposal that a person sees before saving.
- **Cost and abuse limits:** `AI_DAILY_LIMIT` calls per company per UTC day,
  counted from `AiRequest` (attempts, not only successes), plus a burst limiter
  on the route. `AiRequest` stores tokens and outcome, never the text or answer.
- **Errors** reach the client as stable codes: `ai_disabled`, `ai_quota_exceeded`,
  `ai_unavailable`, `ai_busy`, `ai_refused`, `ai_failed`, `ai_nothing_found`.

## Not wired yet

`model/tool-registry.ts` and `model/rejection-tool.ts` remain the foundation for
tool calling (rejection explanations, receipt extraction, spreadsheet mapping).
Before exposing any of them: owned uploads with size/type validation, tenancy
checks inside every handler, and the same review-before-write rule.

## Before commercial launch

Sign the provider's data processing terms, confirm the transfer safeguards
required by Moldovan law for processing in the US, and keep the privacy policy's
AI section in step with what is actually sent.

Contract format: https://developers.openai.com/api/docs/guides/structured-outputs
