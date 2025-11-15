## Jump Social AI

Post-meeting social media generator for financial advisors. Built with Next.js
App Router, Prisma, Supabase (Postgres), Tailwind, and shadcn/ui.

### Stack overview

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 3.4 + shadcn/ui component library
- Prisma ORM targeting Supabase Postgres
- NextAuth v5 (Google, LinkedIn, Facebook providers)
- Google Calendar API via `googleapis`
- Recall.ai bot creation + webhook-based transcription (`/api/recall/start`, `/api/recall/webhook`)
- OpenAI (or fallback templates) for follow-up emails & social drafts

### Local setup

1. Install dependencies (after editing `package.json`):

   ```bash
   npm install
   ```

2. Copy `env.example` → `.env.local` and provide Supabase, OAuth, Recall, and OpenAI secrets.

3. Push the Prisma schema to Supabase & generate the client:

   ```bash
   npx prisma db push
   npm run prisma:generate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

### Recall webhooks

- Configure Recall to POST `recording.done` and `transcript.done` events to
  `https://YOUR_DOMAIN/api/recall/webhook`.
- (Optional) Set `RECALL_WEBHOOK_SECRET` and provide it via the `x-recall-secret`
  header (or `?secret=` query) so the webhook is authenticated.
- Flow: create bot → webhook (`recording.done`) → app requests an async
  transcript → webhook (`transcript.done`) → app downloads transcript + runs
  automations. No polling required.

### Automation flow

- When Recall signals a transcript is ready, `runMeetingAutomations`:
  - Generates a follow-up email (if missing)
  - Runs each enabled automation to draft social posts (LinkedIn/Facebook)
  - Auto-posts when `autoPost` is enabled, otherwise leaves drafts in REVIEW
- Manual regenerate buttons on the meeting detail page let advisors retry email
  copy or push social posts live with one click, showing real-time status badges.

### Deployment (Vercel + Supabase)

1. **Create infrastructure**
   - Provision a Supabase (or any Postgres) project. Copy the pooled connection
     string into `DATABASE_URL` and the “direct” string into `DIRECT_URL`.
   - In Vercel, import this repo and select the **Next.js** framework preset.

2. **Set environment variables** (Vercel → Project → Settings → Environment)

   | Variable | Description |
   | --- | --- |
   | `DATABASE_URL`, `DIRECT_URL` | Supabase Postgres URLs |
   | `NEXTAUTH_SECRET` | `openssl rand -hex 32` (must match locally & prod) |
   | `NEXTAUTH_URL` | e.g. `https://your-app.vercel.app` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth (include `https://your-app.vercel.app/api/auth/callback/google` redirect and add `webshookeng@gmail.com` as test user; enable Google Calendar API) |
   | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn developer app with Marketing permissions |
   | `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Meta app with `pages_manage_posts` scope |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Optional if you expose Supabase client-side (currently unused but reserved) |
   | `RECALL_API_KEY` | Provided Recall.ai key |
   | `RECALL_WEBHOOK_SECRET` | Shared secret for `/api/recall/webhook` verification (optional but recommended) |
   | `OPENAI_API_KEY` | OpenAI key for GPT-powered copy (fallback template used if absent) |

3. **Run migrations**
   - Locally: `npx prisma migrate deploy` (or `db push`) against Supabase to ensure all schema changes exist in prod.
   - Commit and push so Vercel picks up the latest Prisma client.

4. **Configure OAuth redirect URIs**
   - Google: `https://your-app.vercel.app/api/auth/callback/google`
   - LinkedIn: `https://your-app.vercel.app/api/auth/callback/linkedin`
   - Facebook: `https://your-app.vercel.app/api/auth/callback/facebook`
   - Add the Vercel domain to each provider’s authorized origins.

5. **Set up Recall webhooks**
   - In the Recall dashboard, point the webhook URL to `https://your-app.vercel.app/api/recall/webhook`.
   - Add the same `RECALL_WEBHOOK_SECRET` you configured in Vercel so the route can validate requests.
   - Once a meeting ends, Recall sends `recording.done` → we request an async transcript → Recall sends `transcript.done` → automations run automatically.

6. **Deploy**
   - Push to the main branch (or trigger a Vercel deploy). Ensure `npm run build` succeeds in CI.
   - After the first deploy, test:
     1. Sign in with Google.
     2. Sync calendars and toggle the notetaker.
     3. Wait for Recall polling to ingest a transcript and confirm automations generate posts/emails.
     4. Connect LinkedIn/Facebook and post a sample draft.

### Feature map

- `/` – marketing splash with CTA
- `/dashboard` – upcoming meetings, Recall toggles, Google sync
- `/settings` – OAuth connections, lead time, automation prompts
- `/meetings` – completed meetings list
- `/meetings/[id]` – transcript viewer, follow-up email, social drafts + posting

### Directory highlights

- `app/` – App Router routes & layouts
- `components/ui/` – shadcn/ui components ready for reuse
- `lib/prisma.ts` – reusable Prisma client
- `prisma/schema.prisma` – database schema for users, meetings, automations, etc.

More detailed implementation notes will be added as each phase is completed.
