## Jump Social AI

Post-meeting social media generator for financial advisors. Built with Next.js
App Router, Prisma, Supabase (Postgres), Tailwind, and shadcn/ui.

### Stack overview

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 3.4 + shadcn/ui component library
- Prisma ORM targeting Supabase Postgres
- NextAuth v5 (Google, LinkedIn, Facebook providers)
- Google Calendar API via `googleapis`
- Recall.ai bot creation + polling (`/api/recall/start`, `/api/recall/poll`)
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

### Cron / polling

Hit `POST /api/recall/poll` every 2 minutes (e.g., via Vercel Cron). If you set
`RECALL_POLL_SECRET`, include `Authorization: Bearer <secret>` in the request.

### Automation flow

- When Recall signals a transcript is ready, `runMeetingAutomations`:
  - Generates a follow-up email (if missing)
  - Runs each enabled automation to draft social posts (LinkedIn/Facebook)
  - Auto-posts when `autoPost` is enabled, otherwise leaves drafts in REVIEW
- Manual regenerate buttons on the meeting detail page let advisors retry email
  copy or push social posts live with one click, showing real-time status badges.

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
