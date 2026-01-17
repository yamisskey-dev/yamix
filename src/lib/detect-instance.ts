import type { InstanceType } from "@/types";

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
    console.error(`Failed to detect instance type for ${host}:`, error);
    return null;
  }
}

async function detectMisskeyByApi(host: string): Promise<InstanceType | null> {
  try {
    const metaResponse = await fetch(`https://${host}/api/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
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
      { next: { revalidate: 3600 } }
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

    const infoResponse = await fetch(nodeInfoUrl);
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
