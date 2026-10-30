import {createHash} from "node:crypto";
import fs from "node:fs/promises";

export type PressReleaseSource = {
  _type: "pressReleaseSource";
  messageId: string;
  accountEmail: string;
  subject: string;
  sender: string;
  receivedAt?: string;
  gmailUrl: string;
  embargoNote?: string;
};

export function parseEmailSource(input: unknown): PressReleaseSource {
  if (!input || typeof input !== "object") throw new Error("Email source must be an object");
  const record = input as Record<string, unknown>;
  const text = (key: string) => typeof record[key] === "string" ? record[key].trim() : "";
  const messageId = text("messageId");
  const accountEmail = text("accountEmail").toLowerCase();
  if (!/^[a-f0-9]{8,64}$/i.test(messageId)) throw new Error("A real Gmail messageId is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) throw new Error("accountEmail is required");
  const subject = text("subject");
  const sender = text("sender");
  if (!subject || !sender) throw new Error("Email subject and sender are required");
  const receivedAt = text("receivedAt");
  if (receivedAt && Number.isNaN(Date.parse(receivedAt))) throw new Error("Invalid receivedAt");
  return {
    _type: "pressReleaseSource", messageId, accountEmail, subject, sender,
    ...(receivedAt ? {receivedAt: new Date(receivedAt).toISOString()} : {}),
    gmailUrl: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(accountEmail)}#all/${messageId}`,
    ...(text("embargoNote") ? {embargoNote: text("embargoNote")} : {}),
  };
}

export async function readEmailSource(filename: string) {
  return parseEmailSource(JSON.parse(await fs.readFile(filename, "utf8")));
}

export function gmailDocumentId(source: Pick<PressReleaseSource, "accountEmail" | "messageId">) {
  const digest = createHash("sha256").update(`${source.accountEmail.toLowerCase()}\0${source.messageId}`).digest("hex");
  return `pressRelease.gmail.${digest.slice(0, 40)}`;
}
