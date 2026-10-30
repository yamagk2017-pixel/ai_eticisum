import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {parseEmailSource, gmailDocumentId} from "../scripts/lib/press-release-source.mts";
import {prepareWorkspace, buildSanityDraft} from "../scripts/news-draft.mts";

const email = {messageId: "1a186df321b5f0ad", accountEmail: "test@example.com", subject: "Test release", sender: "press@example.com", receivedAt: "2026-10-29T17:55:32+09:00"};

test("email identity is stable per account/message, not sender or title", () => {
  const source = parseEmailSource(email);
  assert.equal(gmailDocumentId(source), gmailDocumentId(parseEmailSource({...email, subject: "Corrected title", accountEmail: "TEST@example.com"})));
  assert.notEqual(gmailDocumentId(source), gmailDocumentId(parseEmailSource({...email, accountEmail: "other@example.com"})));
  assert.throws(() => parseEmailSource({...email, messageId: "placeholder"}));
  assert.throws(() => parseEmailSource({...email, receivedAt: "invalid"}));
});

test("email preparation preserves local edits; apply creates only a draft and duplicates preserve Studio edits", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "press-release-test-"));
  try {
    const source = path.join(root, "source.md");
    const metadata = path.join(root, "email.json");
    const hero = path.join(root, "image.jpg");
    const outputDir = path.join(root, "workspace");
    await fs.writeFile(source, "Audition announcement\n\nSource text with details.");
    await fs.writeFile(metadata, JSON.stringify(email));
    await fs.writeFile(hero, "fake image bytes for mock asset upload");
    const options = {source, documentType: "News" as const, emailSource: metadata, hero, outputDir};
    const first = await prepareWorkspace(options);
    let markdown = await fs.readFile(first.draftPath, "utf8");
    assert.match(markdown, /sourceEmail: "\.\/source-email.json"/);
    markdown = markdown.replace("galleryImages: []", 'galleryImages:\n  - path: ./hero.jpg\n    caption: Supplied credit');
    await fs.writeFile(first.draftPath, markdown + "\nEditor note preserved.\n");
    const again = await prepareWorkspace(options);
    assert.equal(again.mode, "existing");
    assert.match(await fs.readFile(first.draftPath, "utf8"), /Editor note preserved/);
    const created: Record<string, unknown>[] = [];
    let uploads = 0;
    let existing: Array<{_id: string; _type: string}> = [];
    const transaction = {
      create(document: Record<string, unknown>) {created.push(document); return transaction;},
      createIfNotExists() {throw Error("Email imports must not create shells");},
      patch() {throw Error("Email imports must not patch existing documents");},
      async commit() {return {};},
    };
    const client = {
      async fetch(query: string) {return query.includes("_id in $ids") ? existing : query.startsWith("!defined") ? true : [];},
      assets: {async upload() {uploads++; return {_id: "image-test-1x1-jpg"};}},
      transaction() {return transaction;},
    } as unknown as NonNullable<Parameters<typeof buildSanityDraft>[1]>;
    const dry = await buildSanityDraft({draft: first.draftPath, apply: false}, client);
    assert.equal(dry.mode, "dry-run");
    assert.equal(uploads, 0);
    assert.equal(created.length, 0);
    assert.equal(dry.galleryImageCount, 1);
    const applied = await buildSanityDraft({draft: first.draftPath, apply: true}, client);
    assert.equal(applied.mode, "apply");
    assert.equal(created.length, 1);
    assert.equal(created[0]._id, `drafts.${gmailDocumentId(parseEmailSource(email))}`);
    assert.equal(uploads, 2);
    assert.deepEqual(created[0].pressReleaseSource, parseEmailSource(email));
    assert.equal((created[0].galleryImages as Array<{caption: string}>)[0].caption, "Supplied credit");
    existing = [{_id: String(created[0]._id), _type: "newsArticle"}];
    assert.equal((await buildSanityDraft({draft: first.draftPath, apply: true}, client)).mode, "existing");
    existing = [{_id: gmailDocumentId(parseEmailSource(email)), _type: "newsArticle"}];
    assert.equal((await buildSanityDraft({draft: first.draftPath, apply: true}, client)).mode, "existing");
    assert.equal(created.length, 1);
    assert.equal(uploads, 2);
    await assert.rejects(prepareWorkspace({...options, documentType: "Event"}), /cannot be changed/);
  } finally {
    await fs.rm(root, {recursive: true, force: true});
  }
});
