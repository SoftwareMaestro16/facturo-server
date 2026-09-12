---
description: Export the OpenAPI document and report which endpoints changed shape.
---

Run `npm run openapi:export`, then compare the result against the previous
`openapi.json` if one is present.

Report, in this order:
1. Endpoints removed or renamed — these break the built client.
2. Request or response fields removed, renamed, or made required.
3. Endpoints added.

Say explicitly whether the client needs `npm run api:generate` re-run, and
whether anything in the client will fail to compile after it.
