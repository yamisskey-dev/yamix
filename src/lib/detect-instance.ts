import type { InstanceType } from "@/types";
import { logger } from "@/lib/logger";

// SECURITY: 外部インスタンスへの fetch はタイムアウトとリダイレクト禁止を必須にする
// （リダイレクト追跡による SSRF 拡大と、応答しないホストによるリソース占有を防ぐ）
const FETCH_TIMEOUT_MS = 5000;

interface NodeInfo {
  software?: {
    name?: string;
  };
}

interface MisskeyMeta {
  features?: {
    miauth?: boolean;
  };
  version?: string;
}

export async function detectInstance(host: string): Promise<InstanceType | null> {
  try {
    // First, try Misskey API directly (most reliable for Misskey forks)
    // This works even when nodeinfo is blocked by CDN/firewall
    const misskeyType = await detectMisskeyByApi(host);
    if (misskeyType) {
      return misskeyType;
    }

    // Fallback to nodeinfo for non-Misskey instances
    const nodeInfoType = await detectByNodeInfo(host);
    if (nodeInfoType) {
      return nodeInfoType;
    }

    return null;
  } catch (error) {
    logger.error(`Failed to detect instance type for ${host}`, {}, error);
    return null;
  }
}

async function detectMisskeyByApi(host: string): Promise<InstanceType | null> {
  try {
    const metaResponse = await fetch(`https://${host}/api/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "error",
    });

    if (!metaResponse.ok) {
      return null;
    }

    const meta: MisskeyMeta = await metaResponse.json();

    // Check if MiAuth is supported (indicates Misskey-like instance)
    if (meta.features?.miauth === true) {
      // Try to detect specific fork by version string
      const version = meta.version?.toLowerCase() || "";

      if (version.includes("cherrypick")) {
        return "cherrypick";
      }
      if (version.includes("sharkey")) {
        return "sharkey";
      }
      if (version.includes("iceshrimp")) {
        return "iceshrimp";
      }

      // Default to misskey for any MiAuth-compatible instance
      return "misskey";
    }

    // Even without miauth feature flag, if /api/meta works it's likely Misskey
    if (meta.version) {
      return "misskey";
    }

    return null;
  } catch {
    return null;
  }
}

async function detectByNodeInfo(host: string): Promise<InstanceType | null> {
  try {
    const nodeInfoResponse = await fetch(
      `https://${host}/.well-known/nodeinfo`,
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "error",
      }
    );

    if (!nodeInfoResponse.ok) {
      return null;
    }

    const nodeInfoLinks = await nodeInfoResponse.json();
    const nodeInfoUrl = nodeInfoLinks.links?.find(
      (link: { rel: string }) =>
        link.rel === "http://nodeinfo.diaspora.software/ns/schema/2.1" ||
        link.rel === "http://nodeinfo.diaspora.software/ns/schema/2.0"
    )?.href;

    if (!nodeInfoUrl) {
      return null;
    }

    // SECURITY: href は外部インスタンスが返す値。検証せずに fetch すると
    // 任意 URL への second-hop SSRF になるため、https + 同一ホストを強制する
    let parsedNodeInfoUrl: URL;
    try {
      parsedNodeInfoUrl = new URL(nodeInfoUrl);
    } catch {
      return null;
    }
    if (parsedNodeInfoUrl.protocol !== "https:" || parsedNodeInfoUrl.hostname !== host) {
      logger.warn("nodeinfo href points outside the original host, skipping", {
        host,
        nodeInfoUrl,
      });
      return null;
    }

    const infoResponse = await fetch(nodeInfoUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "error",
    });
    if (!infoResponse.ok) {
      return null;
    }

    const nodeInfo: NodeInfo = await infoResponse.json();
    const softwareName = nodeInfo.software?.name?.toLowerCase();

    switch (softwareName) {
      case "misskey":
        return "misskey";
      case "cherrypick":
        return "cherrypick";
      case "iceshrimp":
        return "iceshrimp";
      case "sharkey":
        return "sharkey";
      case "mastodon":
        return "mastodon";
      case "iceshrimp.net":
        return "Iceshrimp.NET";
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function isMisskeyLike(type: InstanceType): boolean {
  return ["misskey", "cherrypick", "iceshrimp", "sharkey"].includes(type);
}

export function isMastodonLike(type: InstanceType): boolean {
  return ["mastodon", "Iceshrimp.NET"].includes(type);
}
