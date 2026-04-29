# DMBB.ie Redesign

Production-ready redesign of the Dublin Men's Basketball Board website, built with Next.js.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Zod + Cheerio for official DMBB ingestion parsing/validation
- Prisma (PostgreSQL) for persistence scaffolding
- Sanity client integration for editable hero/editorial content

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

## Useful Commands

- `npm run lint` - lint checks
- `npm run build` - production build
- `npm run sync:dmbb` - run official data sync parser
- `npm run prisma:generate` - generate Prisma client

## Routes

- `/` home
- `/news`
- `/competitions`
- `/fixtures-results`
- `/api/sync` ingestion health/count endpoint
