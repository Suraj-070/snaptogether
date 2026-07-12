# Connecting SnapTogether to Supabase

The code is now wired up for Supabase (Postgres + Storage). You just need to
point it at your own project. Takes about 5 minutes.

## 1. Get your credentials

In your Supabase project dashboard:

- **Project Settings → Database → Connection string → URI**
  Copy the "Transaction pooler" URI (port `6543`). This goes in `DATABASE_URL`.
- **Project Settings → API**
  Copy the `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  Copy the `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  Copy the `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — never commit it, never expose it to the client)

Paste all four into `.env` (there's a template with placeholders already, and
`.env.example` for reference).

## 2. Push the schema

```bash
bun install        # or npm install — pulls in @supabase/supabase-js
bun run db:push     # prisma db push — creates User, PhotoSession, Photo, Memory tables
```

## 3. Create the storage bucket

In the Supabase dashboard → **Storage** → **New bucket**:

- Name: `snaptogether-photos`
- Public bucket: **ON** (so photo URLs work directly in `<img>` tags without signing)

Then add a policy so uploads/reads work. Easiest path: Storage → your bucket →
**Policies** → "New policy" → pick the **"Allow public read access"** template
for `SELECT`, and since uploads happen server-side via the service role key
(which bypasses RLS), you don't need an INSERT policy for the anon/public role.

If you'd rather do it via SQL, run this in the SQL editor:

```sql
create policy "Public read access"
on storage.objects for select
using ( bucket_id = 'snaptogether-photos' );
```

## 4. That's it

Photos captured in the Studio and saved in Result view now upload to
`snaptogether-photos/photos/*` and `snaptogether-photos/strips/*` in Supabase
Storage, and the database just stores the public URL — not the raw image
data. Everything else (gallery, profile, downloads) keeps working exactly the
same since it was already just rendering whatever string was in `imageData`.

## Notes

- The old `.env` pointed at a local SQLite file — that's gone now, this is a
  hard requirement to use Postgres.
- `db.ts` and every API route are unchanged in shape; only `photos/route.ts`
  and `memories/route.ts` gained an upload step before saving.
