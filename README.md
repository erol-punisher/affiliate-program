Affiliate dashboard and payment records tooling, built on Next.js. Two Google
Sheets act as the underlying data sources: an affiliate roster and a
monthly-tabbed payment record sheet. Auth is Google OAuth, restricted to a
single Workspace domain.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.local.example` to `.env.local` and fill in:

   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from a Google Cloud OAuth
     client (Credentials > OAuth 2.0 Client IDs). The redirect URI
     (`http://localhost:3000/api/auth/callback/google` for local dev) must be
     added to that client's authorized redirect URIs in the Cloud Console.
   - `ALLOWED_DOMAIN` — only Google accounts on this Workspace domain can log
     in. Ask whoever owns the OAuth client if you need this changed for local
     dev with a different account.
   - `SESSION_SECRET` — random string, e.g. `openssl rand -base64 32`.
   - `SPREADSHEET_ID` / `SHEET_GID` — the affiliate sheet.
   - `PAYMENT_SPREADSHEET_ID` / `PAYMENT_SHEET_GID` — the payment record
     sheet (used as the default tab; the app lists and switches between all
     month tabs in this spreadsheet).

   Also create a separate **`.env`** file (Prisma's CLI only reads `.env`,
   not `.env.local`) with:

   ```
   DATABASE_URL="file:./dev.db"
   ```

   Whoever runs the app also needs their signed-in Google account to have
   edit access to both spreadsheets — OAuth alone doesn't grant that.

3. **Database**

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Run it**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Other commands

```bash
npm test    # vitest — unit tests for the normalization/rules engine
npm run lint
npm run build
```

## Structure

- `src/app` — routes (App Router). `/` is the affiliate dashboard, `/payments`
  is the payment records view, both gated by `src/proxy.ts`.
- `src/lib/rules/` — the affiliate data normalization pipeline (phone,
  commission, tier, status, etc. — see the `__tests__` alongside each rule).
- `src/lib/sheets.ts` — all Google Sheets API read/write calls.
- `prisma/` — schema and migrations for the affiliate/issue/duplicate data
  imported from the sheet via `POST /api/admin/import`.
