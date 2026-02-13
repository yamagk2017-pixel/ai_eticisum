import { createServerClient } from "@/lib/supabase/server";

type ParsedEvent = {
  eventName: string;
  eventDate: string;
  venueName: string;
  eventUrl: string;
};

function isValidEventName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 200) return false;
  const invalidPatterns = [
    /^申込受付中$/,
    /^受付中$/,
    /^イベント$/,
    /^公演$/,
    /padding/i,
    /margin/i,
    /font-/i,
    /cursor:/i,
    /height:/i,
    /width:/i,
    /display:/i,
    /\d+rem/i,
    /\d+px/i,
    /\d+em/i,
    /^Event [A-Za-z0-9]+$/,
    /日程未定/,
    /^未定$/,
    /チケットの分配/,
    /<[^>]+>/,
    /;/,
    /^[0-9.:]+$/,
    /^[\s\d.]+$/,
  ];
  return !invalidPatterns.some((pattern) => pattern.test(name));
}

function isValidVenueName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 200) return false;
  const invalidPatterns = [
    /^会場未定$/,
    /^未定$/,
    /^申込受付中$/,
    /^受付中$/,
    /padding/i,
    /margin/i,
    /path\s+fill/i,
    /svg/i,
    /fill-rule/i,
    /clip-rule/i,
    /evenodd/i,
    /^d="/i,
    /チケットの分配/,
    /<[^>]+>/,
    /^\s*$/,
  ];
  return !invalidPatterns.some((pattern) => pattern.test(name));
}

function parseTicketDiveHtml(html: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const cleanedHtml = html
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<path[^>]*\/?>/gi, "")
    .replace(/fill-rule="[^"]*"/gi, "")
    .replace(/clip-rule="[^"]*"/gi, "")
    .replace(/d="[^"]*"/gi, "");

  const eventLinkPattern = /href="\/event\/([^"]+)"/g;
  const eventIds: string[] = [];
  let match: RegExpExecArray | null = null;
  while (true) {
    match = eventLinkPattern.exec(cleanedHtml);
    if (!match) break;
    eventIds.push(match[1]);
  }

  for (const eventId of eventIds) {
    const eventIndex = cleanedHtml.indexOf(`/event/${eventId}`);
    if (eventIndex === -1) continue;

    const contextStart = Math.max(0, eventIndex - 1000);
    const contextEnd = Math.min(cleanedHtml.length, eventIndex + 7000);
    const context = cleanedHtml.substring(contextStart, contextEnd);

    const datePattern = /(\d{4})\/(\d{1,2})\/(\d{1,2})/;
    const dateMatch = context.match(datePattern);
    const eventDate = dateMatch ? dateMatch[0] : null;
    if (!eventDate) continue;

    let eventName: string | null = null;
    const dateIndex = context.indexOf(eventDate);
    const beforeDate = context.substring(Math.max(0, dateIndex - 1000), dateIndex);
    const cleanBeforeDate = beforeDate
      .replace(/<[^>]+>/g, "\n")
      .replace(/&[^;]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const lines = cleanBeforeDate
      .split(/[\n\r]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .reverse();

    for (const line of lines) {
      const chunks = line
        .split(/[|>]/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0)
        .reverse();
      for (const chunk of chunks) {
        if (chunk.length >= 5 && chunk.length <= 100 && isValidEventName(chunk)) {
          eventName = chunk;
          break;
        }
      }
      if (eventName) break;
    }

    let venueName: string | null = null;
    const afterDate = context.substring(context.indexOf(eventDate) + eventDate.length, context.indexOf(eventDate) + 1000);
    const cleanText = afterDate
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
      .replace(/<path[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const venuePatterns = [
      /<div[^>]*class="[^"]*venue[^"]*"[^>]*>([^<]+)<\/div>/i,
      /<div[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/div>/i,
      /<span[^>]*class="[^"]*venue[^"]*"[^>]*>([^<]+)<\/span>/i,
      /<p[^>]*class="[^"]*venue[^"]*"[^>]*>([^<]+)<\/p>/i,
    ];

    for (const pattern of venuePatterns) {
      const m = afterDate.match(pattern);
      if (m && m[1]) {
        const candidate = m[1].trim();
        if (isValidVenueName(candidate)) {
          venueName = candidate;
          break;
        }
      }
    }

    if (!venueName) {
      const chunks = cleanText
        .split(/[|<\n]/)
        .map((c) => c.trim())
        .filter((c) => c.length > 2 && c.length < 100);
      for (const candidate of chunks) {
        if (isValidVenueName(candidate)) {
          venueName = candidate;
          break;
        }
      }
    }

    if (!eventName || !venueName) continue;

    const cleanedEventName = eventName
      .replace(/^申込受付中\s*[『「]?/, "")
      .replace(/^受付中\s*[『「]?/, "")
      .replace(/[』」]$/, "")
      .trim();

    if (!isValidEventName(cleanedEventName) || !isValidVenueName(venueName)) continue;

    events.push({
      eventName: cleanedEventName,
      eventDate,
      venueName,
      eventUrl: `https://ticketdive.com/event/${eventId}`,
    });
  }

  return events;
}

export async function scrapeTicketDiveEvent(
  groupId: string,
  ticketdiveId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch(`https://ticketdive.com/artist/${ticketdiveId}`, {
      headers: {
        "User-Agent": "MusiciteBot/1.0 (+https://buzzttara.vercel.app/)",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, count: 0, error: "TicketDiveページが存在しません。" };
      }
      return { success: false, count: 0, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const events = parseTicketDiveHtml(html);
    const supabase = createServerClient();
    await supabase.from("events").delete().eq("group_id", groupId);

    if (events.length === 0) {
      return { success: true, count: 0 };
    }

    const sorted = events.sort((a, b) => {
      const aDate = new Date(a.eventDate.replace(/\//g, "-")).getTime();
      const bDate = new Date(b.eventDate.replace(/\//g, "-")).getTime();
      return aDate - bDate;
    });
    const nearest = sorted[0];

    const { error } = await supabase.from("events").insert({
      group_id: groupId,
      event_name: nearest.eventName,
      event_date: nearest.eventDate,
      venue_name: nearest.venueName,
      event_url: nearest.eventUrl,
    });

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: 1 };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
