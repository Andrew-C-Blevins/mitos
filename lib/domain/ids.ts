// getRandomValues also works in the local phone preview over LAN HTTP.
// crypto.randomUUID requires a secure browser context.
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
