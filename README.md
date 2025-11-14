## Jump Social AI

Post-meeting social media generator for financial advisors. Built with Next.js
App Router, Prisma, Supabase (Postgres), Tailwind, and shadcn/ui.

### Tech stack (Phase 0–3)

- Next.js 15 (App Router) with TypeScript
- Tailwind CSS 3.4 + shadcn/ui component library
- Prisma ORM targeting Supabase Postgres
- NextAuth (upcoming) for Google/LinkedIn/Facebook OAuth

### Local setup

1. Install dependencies (after editing `package.json`):

   ```bash
   npm install
   ```

2. Copy `env.example` → `.env.local` and provide Supabase + OAuth secrets.

3. Push the Prisma schema to Supabase & generate the client:

   ```bash
   npx prisma db push
   npm run prisma:generate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

### Directory highlights

- `app/` – App Router routes & layouts
- `components/ui/` – shadcn/ui components ready for reuse
- `lib/prisma.ts` – reusable Prisma client
- `prisma/schema.prisma` – database schema for users, meetings, automations, etc.

More detailed implementation notes will be added as each phase is completed.
