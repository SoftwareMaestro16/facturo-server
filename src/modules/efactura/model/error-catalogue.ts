/// Turning platform rejections into sentences a director understands.
///
/// This is the product, not a nicety. The state portal answers a bad document
/// with a code; the customer's question is "what do I fix". Every code the
/// platform can return gets an entry here with a cause and a next step, in both
/// interface languages.

export interface EfacturaErrorExplanation {
  /// Stable key the client turns into a translated string.
  code: string;
  ro: string;
  ru: string;
  /// Which form field to focus, when the problem is a specific field.
  field?: string;
  /// Whether retrying the same document unchanged could succeed.
  retryable: boolean;
}

const UNKNOWN: EfacturaErrorExplanation = {
  code: 'efactura_unknown_error',
  ro: 'Sistemul e-Factura a respins documentul fără un motiv pe care îl putem explica. Am salvat răspunsul și îl verificăm.',
  ru: 'Система e-Factura отклонила документ без понятной причины. Ответ сохранён, мы разбираемся.',
  retryable: false,
};

/// Seeded with the failures that are certain to appear, mapped from HTTP and
/// transport level conditions. Platform-specific codes are added as phase 2
/// observes them against the SFS test environment — never invented in advance.
const CATALOGUE: readonly EfacturaErrorExplanation[] = [
  {
    code: 'efactura_unavailable',
    ro: 'Serviciul e-Factura nu răspunde. Documentul rămâne în așteptare și va fi trimis automat.',
    ru: 'Сервис e-Factura не отвечает. Документ остался в очереди и будет отправлен автоматически.',
    retryable: true,
  },
  {
    code: 'efactura_auth_failed',
    ro: 'Conexiunea cu e-Factura a expirat. Reconectați semnătura electronică în Setări.',
    ru: 'Соединение с e-Factura истекло. Переподключите электронную подпись в Настройках.',
    retryable: false,
  },
  {
    code: 'efactura_signature_invalid',
    ro: 'Semnătura electronică nu a fost acceptată. Verificați dacă certificatul este valabil.',
    ru: 'Электронная подпись не принята. Проверьте, действителен ли сертификат.',
    retryable: false,
  },
  {
    code: 'efactura_buyer_not_registered',
    ro: 'Cumpărătorul nu este înregistrat în e-Factura. Verificați IDNO în fișa contragentului.',
    ru: 'Покупатель не зарегистрирован в e-Factura. Проверьте IDNO в карточке контрагента.',
    field: 'counterpartyIdno',
    retryable: false,
  },
  {
    code: 'efactura_totals_mismatch',
    ro: 'Suma documentului nu coincide cu suma rândurilor. Recalculați factura.',
    ru: 'Сумма документа не совпадает с суммой строк. Пересчитайте счёт.',
    retryable: false,
  },
  {
    code: 'efactura_duplicate_number',
    ro: 'O factură cu acest număr a fost deja trimisă. Folosiți următorul număr din serie.',
    ru: 'Счёт с таким номером уже отправлен. Используйте следующий номер серии.',
    field: 'number',
    retryable: false,
  },
];

const BY_CODE = new Map(CATALOGUE.map((entry) => [entry.code, entry]));

export function explain(code: string | undefined): EfacturaErrorExplanation {
  return (code !== undefined ? BY_CODE.get(code) : undefined) ?? UNKNOWN;
}

export function listExplanations(): readonly EfacturaErrorExplanation[] {
  return CATALOGUE;
}
