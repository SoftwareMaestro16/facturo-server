import { describe, expect, it } from 'vitest';

import { EFACTURA_XMLNS, buildInvoiceXml } from './efactura-xml';
import type { EfacturaDocument } from '../providers/efactura-provider';

const BASE_DOCUMENT: EfacturaDocument = {
  referenceId: 'inv_abc',
  cycle: 'LONG',
  draftSeries: 'FAC',
  draftNumber: 42,
  issueDate: '2026-09-12',
  supplier: {
    name: 'SRL Alfa',
    idno: '1003600000001',
    vatCode: '000001',
    address: 'str. Alfa 1',
    iban: 'MD24AG000225100013104168',
    bankName: 'Moldova Agroindbank',
  },
  buyer: {
    name: 'SRL Partener',
    idno: '1009600054321',
    vatCode: '123456',
    address: 'str. Bravo 2',
  },
  currency: 'MDL',
  lines: [
    {
      position: 1,
      name: 'Consultanță IT',
      unit: 'H87',
      quantity: '2.500',
      priceNet: '100.00',
      vatRate: '20',
      amountNet: '250.00',
      vatAmount: '50.00',
      amountGross: '300.00',
    },
  ],
  subtotal: '250.00',
  vatTotal: '50.00',
  total: '300.00',
};

describe('buildInvoiceXml', () => {
  it('opens with an XML declaration and the platform namespace on the root', () => {
    const xml = buildInvoiceXml(BASE_DOCUMENT);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`<Factura xmlns="${EFACTURA_XMLNS}">`);
  });

  it('carries every mandatory field of the header', () => {
    const xml = buildInvoiceXml(BASE_DOCUMENT);

    expect(xml).toContain('<Cycle>LONG</Cycle>');
    expect(xml).toContain('<DraftSeries>FAC</DraftSeries>');
    expect(xml).toContain('<DraftNumber>42</DraftNumber>');
    expect(xml).toContain('<IssueDate>2026-09-12</IssueDate>');
  });

  it('leaves the transport block out when there is no transport', () => {
    expect(buildInvoiceXml(BASE_DOCUMENT)).not.toContain('<Transport>');
  });

  it('adds the transport block for goods that move', () => {
    const xml = buildInvoiceXml({
      ...BASE_DOCUMENT,
      transport: {
        loadingPoint: 'str. Alfa 1',
        unloadingPoint: 'str. Bravo 2',
        vehicleNumber: 'CJ 12 ABC',
      },
    });

    expect(xml).toContain('<LoadingPoint>str. Alfa 1</LoadingPoint>');
    expect(xml).toContain('<UnloadingPoint>str. Bravo 2</UnloadingPoint>');
    expect(xml).toContain('<VehicleNumber>CJ 12 ABC</VehicleNumber>');
  });

  it('escapes the five XML entities in text nodes', () => {
    const xml = buildInvoiceXml({
      ...BASE_DOCUMENT,
      notes: `Comparison of A & B < C > D "quoted" 'single'`,
    });

    expect(xml).toContain('A &amp; B &lt; C &gt; D &quot;quoted&quot; &apos;single&apos;');
  });

  it('omits optional fields rather than emitting empty elements', () => {
    const xml = buildInvoiceXml({
      ...BASE_DOCUMENT,
      supplier: { name: 'SRL Alfa', idno: '1003600000001' },
      buyer: { name: 'SRL Partener', idno: '1009600054321' },
    });

    expect(xml).not.toContain('<VatCode>');
    expect(xml).not.toContain('<Address></Address>');
  });

  it('keeps a line for every position, in order', () => {
    const xml = buildInvoiceXml({
      ...BASE_DOCUMENT,
      lines: [
        { ...BASE_DOCUMENT.lines[0]!, position: 1, name: 'First' },
        { ...BASE_DOCUMENT.lines[0]!, position: 2, name: 'Second' },
      ],
    });

    expect(xml.indexOf('First')).toBeLessThan(xml.indexOf('Second'));
    expect((xml.match(/<Line>/g) ?? []).length).toBe(2);
  });
});
