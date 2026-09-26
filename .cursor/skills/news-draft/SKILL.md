---
name: news-draft
description: Creates local News, Radio, or Event Sanity draft workspaces from pasted plain text, Word, or PDF files. Use when the user says 「ニュースを作ります」, provides a news manuscript, requests an explicitly directed rewrite, or asks to create a Sanity news draft.
---

# News draft workflow

Use this project workflow to prepare `newsArticle` drafts. Do not call a generative AI API.

## Rules

- Treat 「ニュースを作ります」 as the start of this workflow.
- Require the user to specify exactly one article type: `News`, `Radio`, or `Event`. Never infer or default it. If omitted, ask for it before preparing files.
- Map `News` to `newsArticle`, `Radio` to `radioAnnouncement`, and `Event` to `eventAnnouncement`.
- Accept pasted plain text or an attached `.txt`, `.docx`, or `.pdf` manuscript.
- Accept one attached image as the hero image. Do not add inline or gallery images unless the user expands the scope.
- Never decide whether rewriting is needed. Rewrite only when the user explicitly requests it.
- A rewrite request may arrive before preparation or after `draft.md` exists.
- Preserve facts, names, dates, URLs, and user-filled metadata during rewrites. Do not invent missing facts.
- The user fills missing fields directly in `draft.md`; do not require chat-based field collection.
- Missing editorial fields never block creation of a Sanity draft. Keep them empty and report them as warnings.
- Check every `relatedGroups` entry against Supabase IMDB (`imd.groups`) before creating or updating a Sanity draft.
- When exactly one normalized `name_ja` match exists, save its `id` as `imdGroupId`. Verify an explicitly supplied `imdGroupId` still exists.
- If an IMDB group is missing or ambiguous, keep the group name, omit `imdGroupId`, report a warning, and continue creating the draft.
- Do not invent placeholder values merely to satisfy schema validation.
- Create only a Sanity draft. Never publish a document.

## Prepare the workspace

For a file manuscript, execute:

```bash
npm run draft:news -- prepare --type=News --source=/absolute/path/to/source.docx --hero=/absolute/path/to/hero.jpg
```

For pasted text, first save the text unchanged to a `.txt` file under `tmp/news-inbox/`, then use that file as `--source`.

The command creates a timestamped directory under `tmp/news-drafts/` containing:

- `source.<ext>`: unchanged source manuscript
- `extracted.txt`: deterministically extracted text
- `hero.<ext>`: unchanged hero image, when supplied
- `draft.md`: user-editable metadata and article body

`draft.md` must include the explicitly selected `documentType`. Include only the relevant type-specific fields:

- `News`: common article fields only.
- `Radio`: add `broadcastDate`, `eventTimeText`, `personality`, `representativePerformers`, `archiveUrl`, and `afterTalkUrl`.
- `Event`: add the event title/date/time, venue, organizer, performer, price, ticket, streaming, and related event fields defined by the project schema.

Tell the user the absolute path to `draft.md`. Do not ask them to re-enter missing fields in chat.

## Populate the draft

- Use the source title as a provisional title when one can be identified.
- Use the workspace creation time for `publishedAt` unless the source or user specifies another publication time.
- Generate a concise lowercase ASCII slug candidate from the title and write it to `draft.md`. Do this with the current Codex session, not an external AI API.
- If no meaningful title is available, leave slug generation to the CLI timestamp fallback.
- Propose categories, tags, and related groups from the article and existing Sanity values. The user may edit them.
- In the body, convert paired Markdown `**text**` to the Sanity Portable Text `strong` mark. Do not add other emphasis syntax unless the user explicitly expands the scope.
- Leave unknown fields empty.
- If rewriting was requested before preparation, update the title/body in `draft.md` after extraction.
- If rewriting is requested later, edit only the requested title/body sections and preserve all metadata the user entered.

## Sanity handoff

When the user asks to create the Sanity draft:

1. Read the current `draft.md` from disk.
2. Check field completeness and referenced local files.
3. Report incomplete fields as warnings, but continue creating the draft.
4. Omit missing fields from the Sanity payload instead of inserting fake values.
5. Recheck the slug across `newsArticle`, `eventAnnouncement`, and `radioAnnouncement`. On collision, append the publication date and then a sequence number.
6. Resolve and report every `relatedGroups` IMDB match. Auto-fill `imdGroupId` only for one exact normalized name match.
7. Stop only for technical failures such as an unreadable manuscript, malformed `draft.md`, failed IMDB query, failed asset upload, or failed Sanity write.
8. Generate and show a dry-run summary, including the IMDB check result.
9. Create or update only the Sanity draft after the user's request clearly authorizes the write.
10. Report the created draft ID, final slug, IMDB match result, incomplete fields, and workspace path.
