/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * SECURITY: Prevent malicious requests to internal/private networks
 */

import dns from "dns/promises";
import { logger } from "@/lib/logger";

// Private IP ranges (RFC 1918, RFC 4193, etc.)
const PRIVATE_IP_RANGES = [
  /^10\./,                           // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
  /^192\.168\./,                     // 192.168.0.0/16
  /^127\./,                          // 127.0.0.0/8 (localhost)
  /^169\.254\./,                     // 169.254.0.0/16 (link-local)
  /^::1$/,                           // IPv6 localhost
  /^fe80:/,                          // IPv6 link-local
  /^fc00:/,                          // IPv6 unique local
  /^fd00:/,                          // IPv6 unique local
];

// Allowed TLDs for Fediverse instances
const ALLOWED_TLDS = [
  ".social", ".com", ".net", ".org", ".jp", ".io", ".de", ".fr", ".uk",
  ".ca", ".au", ".eu", ".info", ".xyz", ".tech", ".online", ".site",
];

/**
 * Validate hostname format
 * SECURITY: Strict hostname validation to prevent SSRF
 */
export function validateHostname(hostname: string): { valid: boolean; error?: string } {
  // Basic format check
  const hostnamePattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;

  if (!hostnamePattern.test(hostname)) {
    return { valid: false, error: "Invalid hostname format" };
  }

  // Check for IP address (should use domain names only)
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipPattern.test(hostname)) {
    return { valid: false, error: "IP addresses are not allowed, use domain names" };
  }

  // Check TLD whitelist
  const hasAllowedTLD = ALLOWED_TLDS.some(tld => hostname.endsWith(tld));
  if (!hasAllowedTLD) {
    logger.warn("Hostname with non-standard TLD", { hostname });
    // Don't reject, but log for monitoring
  }

  // Check length
  if (hostname.length > 253) {
    return { valid: false, error: "Hostname too long" };
  }

  return { valid: true };
}

/**
 * Check if IP is private/internal
 * SECURITY: Prevent access to internal networks
 */
export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(range => range.test(ip));
}

/**
 * Resolve hostname and check for private IPs
 * SECURITY: Prevent DNS rebinding attacks
 */
export async function validateHostnameResolution(hostname: string): Promise<{
  valid: boolean;
  error?: string;
  ips?: string[];
}> {
  try {
    // Resolve both A and AAAA records
    const [ipv4Addresses, ipv6Addresses] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);

    const ips: string[] = [];

    if (ipv4Addresses.status === "fulfilled") {
      ips.push(...ipv4Addresses.value);
    }
    if (ipv6Addresses.status === "fulfilled") {
      ips.push(...ipv6Addresses.value);
    }

    if (ips.length === 0) {
      return { valid: false, error: "Hostname does not resolve to any IP" };
    }

    // Check if any resolved IP is private
    const privateIPs = ips.filter(ip => isPrivateIP(ip));
    if (privateIPs.length > 0) {
      logger.warn("Hostname resolves to private IP (SSRF attempt?)", {
        hostname,
        privateIPs,
      });
      return {
        valid: false,
        error: "Hostname resolves to private/internal IP address",
        ips: privateIPs,
      };
    }

    return { valid: true, ips };
  } catch (error) {
    logger.error("DNS resolution failed", { hostname }, error);
    return {
      valid: false,
      error: "Failed to resolve hostname",
    };
  }
}

/**
 * Full SSRF protection check (hostname + DNS resolution)
 * SECURITY: Comprehensive validation before making external requests
 *
 * @param hostname - The hostname to validate
 * @param options - Options
 * @param options.skipDNSCheck - Skip DNS resolution check (faster, but less secure)
 * @returns Validation result
 */
export async function validateExternalHost(
  hostname: string,
  options: { skipDNSCheck?: boolean } = {}
): Promise<{ valid: boolean; error?: string }> {
  // Step 1: Validate hostname format
  const formatCheck = validateHostname(hostname);
  if (!formatCheck.valid) {
    return formatCheck;
  }

  // Step 2: DNS resolution check (optional)
  if (!options.skipDNSCheck) {
    const dnsCheck = await validateHostnameResolution(hostname);
    if (!dnsCheck.valid) {
      return { valid: false, error: dnsCheck.error };
    }
  }

  return { valid: true };
}

/**
 * Safe URL builder for external requests
 * SECURITY: Ensures only HTTPS and validates hostname
 */
export function buildSafeURL(hostname: string, path: string): string | null {
  const validation = validateHostname(hostname);
  if (!validation.valid) {
    logger.warn("Invalid hostname for URL building", { hostname, error: validation.error });
    return null;
  }

  // Force HTTPS
  return `https://${hostname}${path.startsWith("/") ? path : "/" + path}`;
}
