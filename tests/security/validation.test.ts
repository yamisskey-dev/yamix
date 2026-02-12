/**
 * Security Validation Tests
 *
 * SECURITY: Test XSS, SQL injection, and other attack vector detection
 */

import { describe, it, expect } from "@jest/globals";
import {
  containsXSSPatterns,
  containsSQLInjectionPatterns,
  sanitizeString,
  safeStringSchema,
} from "@/lib/validation";

describe("XSS Detection", () => {
  it("should detect script tags", () => {
    expect(containsXSSPatterns("<script>alert('xss')</script>")).toBe(true);
    expect(containsXSSPatterns("Hello <script>world</script>")).toBe(true);
  });

  it("should detect event handlers", () => {
    expect(containsXSSPatterns('<img src="x" onerror="alert(1)">')).toBe(true);
    expect(containsXSSPatterns('<div onclick="alert(1)">Click</div>')).toBe(true);
    expect(containsXSSPatterns('<body onload="malicious()">')).toBe(true);
  });

  it("should detect javascript: protocol", () => {
    expect(containsXSSPatterns('<a href="javascript:alert(1)">Click</a>')).toBe(true);
    expect(containsXSSPatterns("javascript:void(0)")).toBe(true);
  });

  it("should detect iframe/object/embed tags", () => {
    expect(containsXSSPatterns("<iframe src='evil.com'></iframe>")).toBe(true);
    expect(containsXSSPatterns("<object data='evil.swf'></object>")).toBe(true);
    expect(containsXSSPatterns("<embed src='evil.pdf'>")).toBe(true);
  });

  it("should detect data: URIs with HTML", () => {
    expect(containsXSSPatterns("data:text/html,<script>alert(1)</script>")).toBe(true);
  });

  it("should detect SVG-based XSS", () => {
    expect(containsXSSPatterns('<svg onload="alert(1)">')).toBe(true);
  });

  it("should allow safe strings", () => {
    expect(containsXSSPatterns("Hello World")).toBe(false);
    expect(containsXSSPatterns("This is a safe message.")).toBe(false);
    expect(containsXSSPatterns("User@example.com")).toBe(false);
  });
});

describe("SQL Injection Detection", () => {
  it("should detect UNION-based injection", () => {
    expect(containsSQLInjectionPatterns("1' UNION SELECT * FROM users--")).toBe(true);
    expect(containsSQLInjectionPatterns("' OR 1=1 UNION SELECT password FROM users--")).toBe(true);
  });

  it("should detect dangerous SQL keywords", () => {
    expect(containsSQLInjectionPatterns("DROP TABLE users")).toBe(true);
    expect(containsSQLInjectionPatterns("DELETE FROM users WHERE 1=1")).toBe(true);
    expect(containsSQLInjectionPatterns("INSERT INTO users VALUES")).toBe(true);
    expect(containsSQLInjectionPatterns("UPDATE users SET admin=1")).toBe(true);
  });

  it("should detect SQL comments", () => {
    expect(containsSQLInjectionPatterns("admin'--")).toBe(true);
    expect(containsSQLInjectionPatterns("1' OR 1=1 #")).toBe(true);
    expect(containsSQLInjectionPatterns("' OR 1=1 /*comment*/")).toBe(true);
  });

  it("should detect tautology-based injection", () => {
    expect(containsSQLInjectionPatterns("' OR 1=1--")).toBe(true);
    expect(containsSQLInjectionPatterns("' OR '1'='1")).toBe(true);
    expect(containsSQLInjectionPatterns("admin' AND 1=1--")).toBe(true);
  });

  it("should allow safe strings", () => {
    expect(containsSQLInjectionPatterns("Hello World")).toBe(false);
    expect(containsSQLInjectionPatterns("user@example.com")).toBe(false);
    expect(containsSQLInjectionPatterns("The price is $100")).toBe(false);
  });
});

describe("String Sanitization", () => {
  it("should remove null bytes", () => {
    expect(sanitizeString("Hello\0World")).toBe("HelloWorld");
  });

  it("should remove control characters", () => {
    expect(sanitizeString("Hello\x01\x02World")).toBe("HelloWorld");
  });

  it("should preserve newlines and tabs", () => {
    expect(sanitizeString("Hello\nWorld")).toBe("Hello\nWorld");
    expect(sanitizeString("Hello\tWorld")).toBe("Hello\tWorld");
  });

  it("should trim whitespace", () => {
    expect(sanitizeString("  Hello World  ")).toBe("Hello World");
    expect(sanitizeString("\n\nHello\n\n")).toBe("Hello");
  });
});

describe("Safe String Schema", () => {
  it("should reject XSS attempts", () => {
    const result = safeStringSchema.safeParse("<script>alert(1)</script>");
    expect(result.success).toBe(false);
  });

  it("should reject SQL injection attempts", () => {
    const result = safeStringSchema.safeParse("' OR 1=1--");
    expect(result.success).toBe(false);
  });

  it("should accept and sanitize safe strings", () => {
    const result = safeStringSchema.safeParse("  Hello World  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Hello World");
    }
  });

  it("should reject empty strings", () => {
    const result = safeStringSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("should reject strings that are too long", () => {
    const longString = "a".repeat(10001);
    const result = safeStringSchema.safeParse(longString);
    expect(result.success).toBe(false);
  });
});
