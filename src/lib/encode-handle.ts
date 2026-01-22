/**
 * Encode handle for URL while preserving @ symbol
 * Misskey-style handles like @username@instance.com should keep @ visible in URL
 */
export function encodeHandle(handle: string): string {
  // encodeURIComponent encodes @ as %40, but we want to keep @ visible
  return encodeURIComponent(handle).replace(/%40/g, '@');
}
