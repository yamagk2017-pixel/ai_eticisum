# News ISR Runbook

`/news` is ISR (`revalidate = 60`). To publish/fix articles immediately, trigger on-demand revalidation.

## Endpoint
- `POST /api/revalidate/news`
- Auth: `x-revalidate-token: <NEWS_REVALIDATE_TOKEN>`

## Payload examples

Revalidate only list:

```json
{}
```

Revalidate Sanity detail + list:

```json
{ "slug": "your-news-slug" }
```

Revalidate WP detail + list:

```json
{ "wpId": 12345 }
```

Revalidate explicit paths + list:

```json
{ "paths": ["/news", "/news/your-news-slug", "/news/wp/12345"] }
```

## curl example

```bash
curl -X POST "https://www.musicite.net/api/revalidate/news" \
  -H "content-type: application/json" \
  -H "x-revalidate-token: ${NEWS_REVALIDATE_TOKEN}" \
  -d '{"slug":"your-news-slug"}'
```

## Required env vars
- `NEWS_REVALIDATE_TOKEN` (local + Vercel)

## Sanity webhook integration (auto revalidate on publish/update)

### 1) Vercel env setup
- Add `NEWS_REVALIDATE_TOKEN` to Vercel Project Settings.
- Redeploy once after adding/updating this value.

### 2) Create webhook in Sanity Manage
- Open `sanity.io/manage` -> target project -> API -> Webhooks -> Create webhook
- URL: `https://www.musicite.net/api/revalidate/news`
- Method: `POST`
- Trigger on: `create`, `update`, `delete` (publish/unpublish included if needed)
- Filter (optional): `_type in ["newsArticle","eventAnnouncement","radioAnnouncement","wpImportedArticle"]`
- Header:
  - `x-revalidate-token: <same value as NEWS_REVALIDATE_TOKEN>`

### 3) Payload (recommended)
Use this payload so list + detail can be revalidated:

```json
{
  "slug": slug.current,
  "wpPostId": wpPostId
}
```

Notes:
- `slug` is used for `/news/{slug}`
- `wpPostId` is used for `/news/wp/{id}`
- `/news` is always revalidated even if payload is empty

### 4) Manual test

```bash
curl -X POST "https://www.musicite.net/api/revalidate/news" \
  -H "content-type: application/json" \
  -H "x-revalidate-token: ${NEWS_REVALIDATE_TOKEN}" \
  -d '{"slug":"your-news-slug"}'
```

Expected response includes `ok: true` and `revalidated` path list.
