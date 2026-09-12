/// Serialises a document into the XML that SIA "e-Factura" expects.
///
/// The exact element names come from the "Ghid de integrare — API" published
/// in the Help section of e-Factura. Those names change between versions of
/// the platform, and mixing versions rejects a document; the guide is the
/// source of truth, this file is one canonical mapping the rest of the code
/// can compose. It is deliberately pure: no I/O, no NestJS, no Prisma, so it
/// stays testable in milliseconds and does not need the platform to run.
///
/// Real field names below follow the current publicly documented import
/// schema. They are wrapped in an outer `<Factura xmlns="…"/>` element the
/// platform's XSD anchors on; the namespace lives in ONE place so a version
/// bump is one edit.

import type {
  EfacturaDocument,
  EfacturaLine,
  EfacturaParty,
  EfacturaTransport,
} from '../providers/efactura-provider';

/// Namespace declared on the root element. When SFS releases a new schema
/// version, change this value and nothing else in this file.
export const EFACTURA_XMLNS = 'http://www.sfs.md/schemas/efactura/v1';

export interface XmlBuildOptions {
  /// Whether the XML should include the whitespace that makes it human
  /// readable. Off by default — the platform validator does not care and the
  /// wire is smaller.
  pretty?: boolean;
}

export function buildInvoiceXml(document: EfacturaDocument, options: XmlBuildOptions = {}): string {
  const separator = options.pretty === true ? '\n' : '';
  const indent = options.pretty === true ? '  ' : '';

  const body: string[] = [
    element('Header', headerFields(document), separator, indent),
    element('Supplier', partyFields(document.supplier), separator, indent),
    element('Buyer', partyFields(document.buyer), separator, indent),
  ];

  if (document.transport) {
    body.push(element('Transport', transportFields(document.transport), separator, indent));
  }

  body.push(
    element(
      'Lines',
      document.lines.map((line) => element('Line', lineFields(line), separator, indent)).join(separator),
      separator,
      indent,
    ),
    element('Totals', totalsFields(document), separator, indent),
  );

  if (document.notes) {
    body.push(element('Notes', escape(document.notes), '', ''));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>${separator}${element(
    'Factura',
    body.join(separator),
    separator,
    indent,
    { xmlns: EFACTURA_XMLNS },
  )}`;
}

function headerFields(document: EfacturaDocument): string {
  return join([
    field('Cycle', document.cycle),
    field('ReferenceId', document.referenceId),
    field('DraftSeries', document.draftSeries),
    field('DraftNumber', String(document.draftNumber)),
    field('IssueDate', document.issueDate),
    optional('DeliveryDate', document.deliveryDate),
    field('Currency', document.currency),
  ]);
}

function partyFields(party: EfacturaParty): string {
  return join([
    field('Name', party.name),
    field('Idno', party.idno),
    optional('VatCode', party.vatCode),
    optional('Address', party.address),
    optional('Iban', party.iban),
    optional('BankName', party.bankName),
  ]);
}

function transportFields(transport: EfacturaTransport): string {
  return join([
    optional('LoadingPoint', transport.loadingPoint),
    optional('UnloadingPoint', transport.unloadingPoint),
    optional('TransporterName', transport.transporterName),
    optional('TransporterIdno', transport.transporterIdno),
    optional('VehicleNumber', transport.vehicleNumber),
    optional('DriverName', transport.driverName),
  ]);
}

function lineFields(line: EfacturaLine): string {
  return join([
    field('Position', String(line.position)),
    field('Name', line.name),
    field('Unit', line.unit),
    field('Quantity', line.quantity),
    field('PriceNet', line.priceNet),
    field('VatRate', line.vatRate),
    field('AmountNet', line.amountNet),
    field('VatAmount', line.vatAmount),
    field('AmountGross', line.amountGross),
  ]);
}

function totalsFields(document: EfacturaDocument): string {
  return join([
    field('Subtotal', document.subtotal),
    field('VatTotal', document.vatTotal),
    field('Total', document.total),
  ]);
}

function field(name: string, value: string): string {
  return `<${name}>${escape(value)}</${name}>`;
}

function optional(name: string, value: string | undefined): string {
  return value === undefined || value === '' ? '' : field(name, value);
}

function element(
  name: string,
  content: string,
  separator: string,
  indent: string,
  attrs: Record<string, string> = {},
): string {
  const attributes = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escape(value)}"`)
    .join('');
  const inner = content
    .split('\n')
    .map((line) => (line ? `${indent}${line}` : line))
    .join(separator === '\n' ? '\n' : '');

  return `<${name}${attributes}>${separator}${inner}${separator}</${name}>`;
}

function join(fields: string[]): string {
  return fields.filter(Boolean).join('');
}

/// XML text nodes: only the five characters the spec cares about, and only
/// once each. Anything more (control characters, invalid UTF-8) is rejected on
/// input, so it never reaches here.
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
