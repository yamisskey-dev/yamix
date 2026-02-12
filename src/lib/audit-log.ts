/**
 * Audit Logging System
 *
 * SECURITY: Enterprise-grade audit logging for compliance and security monitoring
 * - Records all security-relevant events
 * - Immutable log entries
 * - SIEM integration ready
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();

/**
 * Audit event types (aligned with OWASP logging guidelines)
 */
export enum AuditEventType {
  // Authentication & Authorization
  AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS",
  AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_SESSION_EXPIRED = "AUTH_SESSION_EXPIRED",
  AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH",

  // Access Control
  AUTHZ_ACCESS_DENIED = "AUTHZ_ACCESS_DENIED",
  AUTHZ_PERMISSION_ESCALATION = "AUTHZ_PERMISSION_ESCALATION",

  // Data Access
  DATA_READ_SENSITIVE = "DATA_READ_SENSITIVE",
  DATA_CREATE = "DATA_CREATE",
  DATA_UPDATE = "DATA_UPDATE",
  DATA_DELETE = "DATA_DELETE",
  DATA_EXPORT = "DATA_EXPORT",

  // Wallet & Financial
  WALLET_TRANSFER = "WALLET_TRANSFER",
  WALLET_GAS_TIP = "WALLET_GAS_TIP",
  WALLET_REWARD = "WALLET_REWARD",
  WALLET_BALANCE_CHECK = "WALLET_BALANCE_CHECK",

  // Security Events
  SECURITY_RATE_LIMIT_EXCEEDED = "SECURITY_RATE_LIMIT_EXCEEDED",
  SECURITY_SUSPICIOUS_ACTIVITY = "SECURITY_SUSPICIOUS_ACTIVITY",
  SECURITY_ENCRYPTION_FAILURE = "SECURITY_ENCRYPTION_FAILURE",
  SECURITY_SSRF_ATTEMPT = "SECURITY_SSRF_ATTEMPT",
  SECURITY_XSS_ATTEMPT = "SECURITY_XSS_ATTEMPT",
  SECURITY_SQL_INJECTION_ATTEMPT = "SECURITY_SQL_INJECTION_ATTEMPT",

  // System Events
  SYSTEM_CONFIG_CHANGE = "SYSTEM_CONFIG_CHANGE",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  SYSTEM_STARTUP = "SYSTEM_STARTUP",
  SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN",
}

/**
 * Risk level for audit events
 */
export enum AuditRiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface AuditLogEntry {
  eventType: AuditEventType;
  riskLevel: AuditRiskLevel;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  result: "SUCCESS" | "FAILURE";
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Log an audit event
 * SECURITY: All security-relevant events should be logged
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // Log to application logger (stdout/file)
    logger.info("AUDIT", {
      eventType: entry.eventType,
      riskLevel: entry.riskLevel,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      resource: entry.resource,
      action: entry.action,
      result: entry.result,
      metadata: entry.metadata,
    });

    // Store in database for long-term retention and analysis
    await prisma.auditLog.create({
      data: {
        eventType: entry.eventType,
        riskLevel: entry.riskLevel,
        userId: entry.userId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        resource: entry.resource,
        action: entry.action,
        result: entry.result,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
        errorMessage: entry.errorMessage,
        timestamp: new Date(),
      },
    });

    // Alert on critical events
    if (entry.riskLevel === AuditRiskLevel.CRITICAL) {
      // TODO: Integrate with alerting system (Slack, PagerDuty, etc.)
      logger.error("CRITICAL SECURITY EVENT", { ...entry });
    }
  } catch (error) {
    // IMPORTANT: Never let audit logging failure break the application
    logger.error("Failed to log audit event", { ...entry }, error);
  }
}

/**
 * Helper: Log authentication event
 */
export async function logAuthEvent(
  eventType: AuditEventType,
  userId: string | undefined,
  ipAddress: string,
  userAgent: string,
  result: "SUCCESS" | "FAILURE",
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType,
    riskLevel: result === "FAILURE" ? AuditRiskLevel.HIGH : AuditRiskLevel.LOW,
    userId,
    ipAddress,
    userAgent,
    resource: "authentication",
    action: eventType,
    result,
    metadata,
  });
}

/**
 * Helper: Log wallet transaction
 */
export async function logWalletEvent(
  eventType: AuditEventType,
  userId: string,
  ipAddress: string,
  amount: number,
  result: "SUCCESS" | "FAILURE",
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType,
    riskLevel: AuditRiskLevel.MEDIUM,
    userId,
    ipAddress,
    resource: "wallet",
    action: eventType,
    result,
    metadata: { ...metadata, amount },
  });
}

/**
 * Helper: Log security event
 */
export async function logSecurityEvent(
  eventType: AuditEventType,
  userId: string | undefined,
  ipAddress: string,
  riskLevel: AuditRiskLevel,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType,
    riskLevel,
    userId,
    ipAddress,
    resource: "security",
    action: eventType,
    result: "FAILURE", // Security events are typically failures
    metadata,
  });
}

/**
 * Helper: Log data access event
 */
export async function logDataAccessEvent(
  eventType: AuditEventType,
  userId: string,
  resource: string,
  action: string,
  result: "SUCCESS" | "FAILURE",
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    eventType,
    riskLevel: AuditRiskLevel.LOW,
    userId,
    resource,
    action,
    result,
    metadata,
  });
}

/**
 * Query audit logs (for admin dashboard or SIEM integration)
 */
export async function queryAuditLogs(filters: {
  eventType?: AuditEventType;
  userId?: string;
  ipAddress?: string;
  riskLevel?: AuditRiskLevel;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.userId) where.userId = filters.userId;
  if (filters.ipAddress) where.ipAddress = filters.ipAddress;
  if (filters.riskLevel) where.riskLevel = filters.riskLevel;
  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) where.timestamp.gte = filters.startDate;
    if (filters.endDate) where.timestamp.lte = filters.endDate;
  }

  return await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: filters.limit || 100,
  });
}

/**
 * Get security metrics (for dashboard)
 */
export async function getSecurityMetrics(timeRange: { start: Date; end: Date }) {
  const logs = await prisma.auditLog.findMany({
    where: {
      timestamp: {
        gte: timeRange.start,
        lte: timeRange.end,
      },
    },
  });

  return {
    totalEvents: logs.length,
    criticalEvents: logs.filter(l => l.riskLevel === AuditRiskLevel.CRITICAL).length,
    highRiskEvents: logs.filter(l => l.riskLevel === AuditRiskLevel.HIGH).length,
    failedLogins: logs.filter(l => l.eventType === AuditEventType.AUTH_LOGIN_FAILURE).length,
    rateLimitExceeded: logs.filter(l => l.eventType === AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED).length,
    suspiciousActivity: logs.filter(l => l.eventType === AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY).length,
  };
}
