# AI Finance Ledger

A personal finance ledger for the Indian market (INR), built with Next.js, TypeScript, Prisma/PostgreSQL, and NextAuth. Transactions can be logged by typing, speaking, or sharing a bank SMS/notification straight into the app — each is parsed by OpenAI into a structured transaction and confirmed before it's saved. Balances and credit card statuses are always computed from the full transaction history, never a stored running total.

## Getting Started

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `NEXTAUTH_SECRET`, and `OPENAI_API_KEY` first.

## Tech

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma ORM on PostgreSQL (Supabase)
- NextAuth for authentication
- OpenAI (`gpt-4o-mini` for parsing, `gpt-4o-transcribe` for voice)

## Testing

```bash
npm run test    # ledger engine unit tests
npm run lint
npx tsc --noEmit
```
