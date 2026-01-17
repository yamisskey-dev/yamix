import type { InstanceType } from "@/types";

interface NodeInfo {
  software?: {
    name?: string;
  };
}

export async function detectInstance(host: string): Promise<InstanceType | null> {
  try {
    // Try nodeinfo 2.1 first
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
        // Check if it's a Misskey fork by trying the API
        try {
          const metaResponse = await fetch(`https://${host}/api/meta`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (metaResponse.ok) {
            return "misskey";
          }
        } catch {
          // Not a Misskey instance
        }
        return null;
    }
  } catch (error) {
    console.error(`Failed to detect instance type for ${host}:`, error);
    return null;
  }
}

export function isMisskeyLike(type: InstanceType): boolean {
  return ["misskey", "cherrypick", "iceshrimp", "sharkey"].includes(type);
}

export function isMastodonLike(type: InstanceType): boolean {
  return ["mastodon", "Iceshrimp.NET"].includes(type);
}
