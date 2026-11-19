/** Geçici olarak ölçülemeyen kaynaklar: bir süre sonra tekrar denemek anlamlı. Kalıcı/deterministik olanlar (ssl, email, shadowit) hariç. */
export const RETRYABLE_SOURCES = ["ssllabs", "otx", "ct", "vulncheck", "hudsonrock", "mozilla", "feodo", "threatfox", "shodan", "nvd"] as const;
export const FOLLOW_UP_DELAY_MS = 5 * 60_000;

/** Tek seferlik takip taraması gerekir mi? Takip taramasının kendisi yeni takip planlamaz. */
export function needsFollowUp(unchecked: string[] | null | undefined, isFollowUp: boolean): boolean {
  if (isFollowUp) return false;
  return (unchecked ?? []).some((s) => (RETRYABLE_SOURCES as readonly string[]).includes(s));
}
