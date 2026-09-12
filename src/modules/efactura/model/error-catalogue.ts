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

/// Seeded with two kinds of entry: failures of the exchange itself, which are
/// certain to appear, and refusals that follow from rules written down in the
/// regulation. Codes specific to the platform's own validator are added as
/// phase 2 observes them against the test environment — never invented in
/// advance, because a wrong sentence is worse than the honest fallback.
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
  {
    // The regulation allows the issue date to be today or up to ten calendar
    // days ahead, and nothing earlier.
    code: 'efactura_issue_date_in_past',
    ro: 'Data facturii a trecut. Puneți data de azi sau o dată din următoarele 10 zile.',
    ru: 'Дата счёта уже прошла. Поставьте сегодняшнюю дату или дату в пределах 10 дней.',
    field: 'issueDate',
    retryable: false,
  },
  {
    code: 'efactura_issue_date_too_far_ahead',
    ro: 'Data facturii este prea departe. Cel mult 10 zile de azi înainte.',
    ru: 'Дата счёта слишком далеко. Не больше 10 дней вперёд.',
    field: 'issueDate',
    retryable: false,
  },
  {
    // If the second signature lands after the issue date, the document can no
    // longer be completed. Saying this plainly is the difference between the
    // customer losing an hour and losing a deduction.
    code: 'efactura_signing_window_closed',
    ro: 'Data facturii a trecut, așa că documentul nu mai poate fi finalizat. Anulați-l și emiteți unul nou cu data de azi.',
    ru: 'Дата счёта прошла, поэтому документ уже нельзя завершить. Отмените его и выставьте новый с сегодняшней датой.',
    field: 'issueDate',
    retryable: false,
  },
  {
    // A finished long-cycle document carries the buyer's signature, so the
    // supplier cannot withdraw it alone.
    code: 'efactura_cancellation_needs_buyer',
    ro: 'Factura este semnată de cumpărător. Anularea are nevoie de acordul lui — am trimis cererea.',
    ru: 'Счёт подписан покупателем. Для отмены нужно его согласие — запрос отправлен.',
    retryable: false,
  },
  {
    code: 'efactura_supplier_not_registered',
    ro: 'Compania dumneavoastră nu apare ca înregistrată în e-Factura. Verificați IDNO în Setări.',
    ru: 'Ваша компания не числится зарегистрированной в e-Factura. Проверьте IDNO в Настройках.',
    field: 'companyIdno',
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
