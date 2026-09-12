---
name: new-endpoint
description: Checklist for adding an HTTP endpoint to facturo-server — DTO, tenancy filter, Swagger description, error codes, tests. Use when adding or changing any route.
---

# Adding an endpoint

Work through this in order. Each step exists because skipping it has a specific
cost, named below.

## 1. Decide where the logic lives

If the change is a rule — a calculation, a permitted transition, a limit — it
goes in `src/modules/<domain>/model/` as a pure function with a test, and the
service calls it. Only orchestration and Prisma calls belong in the service.

**Cost of skipping:** the rule becomes untestable without a database, so it stops
being tested, so it drifts.

## 2. Write the DTO

```ts
export class CreateInvoiceDto {
  @IsString() @Length(1, 10) series!: string;
  @IsDateString() issueDate!: string;
  @ValidateNested({ each: true }) @Type(() => InvoiceLineDto) lines!: InvoiceLineDto[];
}
```

The global pipe runs with `whitelist: true` and `forbidNonWhitelisted: true`.
A field you do not declare is rejected with a 400, not quietly ignored.

Never accept `companyId` from the client. It comes from the token.

## 3. Filter by tenancy

```ts
const invoice = await this.prisma.invoice.findFirst({
  where: { id, companyId: user.companyId },
});
```

`findUnique({ where: { id } })` followed by a check is not equivalent: it leaks
existence. Use `findFirst` with both conditions.

**Cost of skipping:** one customer reads another's documents.

## 4. Describe it for Swagger

```ts
@ApiOkResponse({ type: InvoiceResponseDto })
@ApiBadRequestResponse({ description: 'invoice_totals_mismatch' })
```

The client generates its entire data layer from `openapi.json`. An endpoint with
no description produces no hook, and someone will hand-write a `fetch` instead.

## 5. Return stable error codes

```ts
throw new BadRequestException({ code: 'invoice_not_editable', message: 'Invoice is not a draft' });
```

`code` is what the client maps to a translated sentence. The `message` is for
logs and developers, never for the customer's screen.

## 6. Verify

```bash
npm run verify
npm run openapi:export
```

Say which endpoints changed shape. That is a breaking change for the built
client, not a detail.
