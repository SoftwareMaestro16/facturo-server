# AI tools foundation

This package is deliberately not registered in AppModule. It performs no OpenAI
requests and adds no public endpoint. The registry publishes only implemented
handlers; the initial tool list is empty.

Contracts cover receipt extraction, rejection explanations and spreadsheet column
mapping. Each consumes an opaque resource ID and locale, returning a proposal for
human review. User/company identity comes exclusively from the authenticated
server context. Every future handler must query resources with companyId, reject
inaccessible uploads, and avoid exposing raw storage paths or secrets.

Next implementation steps:

1. Add owned uploads with size/type validation and retention policy.
2. Implement handlers with bounded outputs: decimal money strings, nullable unknown
   fields, source evidence and confidence. Use the existing e-Factura catalogue
   before requesting a model explanation.
3. Add a server-only Responses adapter, explicit configured model/API key, timeouts,
   per-company quotas, maximum tool rounds, store:false and redacted error logs.
4. Validate model output, then show a review screen. Existing domain services handle
   user-confirmed writes; tools never submit invoices or initiate payments.
5. Test cross-company access, prompt injection in uploaded content, malformed model
   output, provider failures and cost limits before enabling the module.

Function contract format follows the official OpenAI documentation:
https://developers.openai.com/api/docs/guides/function-calling
