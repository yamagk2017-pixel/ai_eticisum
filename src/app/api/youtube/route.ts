import { NextResponse } from "next/server";

type YouTubeApiResponse = {
  videoId?: string;
  channelId?: string;
  error?: string;
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function extractVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace("/", "") || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const match = parsed.pathname.match(/\/embed\/([A-Za-z0-9_-]+)/);
      if (match) return match[1];
    }
  } catch {
    return null;
  }
  return null;
}

function extractChannelId(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/channel\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];
  } catch {
    return null;
  }
  return null;
}

function extractHandle(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/@([A-Za-z0-9._-]+)/);
    if (match) return match[1];
  } catch {
    return null;
  }
  return null;
}

function extractUserOrCustom(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(c|user)\/([A-Za-z0-9._-]+)/);
    if (match) return { type: match[1], value: match[2] };
  } catch {
    return null;
  }
  return null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function GET(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json<YouTubeApiResponse>(
      { error: "Missing YOUTUBE_API_KEY" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";
  const externalId = searchParams.get("external_id") ?? "";

  const videoFromUrl = url ? extractVideoId(url) : null;
  if (videoFromUrl) {
    return NextResponse.json<YouTubeApiResponse>({ videoId: videoFromUrl });
  }

  let channelId: string | null = null;
  if (externalId && externalId.startsWith("UC")) {
    channelId = externalId;
  }
  if (!channelId && url) {
    channelId = extractChannelId(url);
  }

  try {
    if (!channelId && url) {
      const handle = extractHandle(url);
      if (handle) {
        const data = await fetchJson<{ items?: { id: string }[] }>(
          `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(
            handle
          )}&key=${apiKey}`
        );
        channelId = data.items?.[0]?.id ?? null;
      }
    }

    if (!channelId && url) {
      const info = extractUserOrCustom(url);
      if (info?.type === "user") {
        const data = await fetchJson<{ items?: { id: string }[] }>(
          `${YOUTUBE_API_BASE}/channels?part=id&forUsername=${encodeURIComponent(
            info.value
          )}&key=${apiKey}`
        );
        channelId = data.items?.[0]?.id ?? null;
      }
    }

    if (!channelId && url) {
      const info = extractUserOrCustom(url);
      if (info?.type === "c") {
        const data = await fetchJson<{ items?: { id?: { channelId?: string } }[] }>(
          `${YOUTUBE_API_BASE}/search?part=id&type=channel&maxResults=1&q=${encodeURIComponent(
            info.value
          )}&key=${apiKey}`
        );
        channelId = data.items?.[0]?.id?.channelId ?? null;
      }
    }

    if (!channelId) {
      return NextResponse.json<YouTubeApiResponse>({
        error: "Channel ID not found",
      });
    }

    const channelDetails = await fetchJson<{
      items?: {
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
        brandingSettings?: { channel?: { unsubscribedTrailer?: string } };
      }[];
    }>(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails,brandingSettings&id=${encodeURIComponent(
        channelId
      )}&key=${apiKey}`
    );
    const trailerId =
      channelDetails.items?.[0]?.brandingSettings?.channel?.unsubscribedTrailer ??
      null;
    const uploadsPlaylist =
      channelDetails.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;

    if (trailerId) {
      return NextResponse.json<YouTubeApiResponse>({
        channelId,
        videoId: trailerId,
      });
    }

    if (!uploadsPlaylist) {
      return NextResponse.json<YouTubeApiResponse>({
        channelId,
        error: "Uploads playlist not found",
      });
    }

    const playlistItems = await fetchJson<{
      items?: { contentDetails?: { videoId?: string } }[];
    }>(
      `${YOUTUBE_API_BASE}/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(
        uploadsPlaylist
      )}&maxResults=1&key=${apiKey}`
    );
    const videoId = playlistItems.items?.[0]?.contentDetails?.videoId ?? null;

    return NextResponse.json<YouTubeApiResponse>({
      channelId,
      videoId: videoId ?? undefined,
    });
  } catch (error) {
    return NextResponse.json<YouTubeApiResponse>(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
