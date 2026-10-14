
/**
 * Estylo Coffee - UUID Generator
 *
 * Generates RFC 4122 version 4 UUIDs.
 *
 * Supports:
 * - HTTPS
 * - HTTP localhost
 * - HTTP local network hostnames
 * - iPad Safari
 * - Chrome, Firefox and Edge
 *
 * Uses cryptographically secure random values.
 */

export function generateUUID(): string {
  // Use the native implementation when available.
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  // getRandomValues is also available in supported
  // browsers on non-secure HTTP origins.
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.getRandomValues !== "function"
  ) {
    throw new Error(
      "Secure random number generation is unavailable."
    );
  }

  const bytes = new Uint8Array(16);

  globalThis.crypto.getRandomValues(bytes);

  // Set UUID version 4.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;

  // Set RFC 4122 variant.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  );

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
}
