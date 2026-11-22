export function canonicalHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}
