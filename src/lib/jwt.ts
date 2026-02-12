import * as jose from "jose";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "yamix-dev-secret-key";
}

const JWT_ISSUER = "yamix";
const JWT_AUDIENCE = "yamix-users";
const JWT_EXPIRY = "7d"; // 7 days

export interface JWTPayload {
  sub: string; // user handle
  userId: string;
  walletId: string;
  hostName: string;
  iat?: number;
  exp?: number;
}

function getSecret() {
  return new TextEncoder().encode(getJwtSecret());
}

export async function createJWT(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret());
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as unknown as JWTPayload;
  } catch {
    // JWT verification failure is expected for expired/invalid tokens - no logging needed
    return null;
  }
}

export function getTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies["yamix-token"] || null;
}

export function createTokenCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  return `yamix-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function createLogoutCookie(): string {
  return "yamix-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}
