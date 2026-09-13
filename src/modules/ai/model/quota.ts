/// The daily limit resets at midnight UTC for every company alike, so the
/// number shown in settings and the number enforced here always agree.
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function hasAiQuota(usedToday: number, dailyLimit: number): boolean {
  return usedToday < dailyLimit;
}
