# Bitespeed Backend — Identity Reconciliation

A backend service that identifies and links customer contacts across multiple purchases, even when different email addresses and phone numbers are used.

## Live Endpoint

> **Base URL:** `https://bitespeed-backend-zfgr.onrender.com`
>
> **POST** `/identify`


## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Validation:** Zod
- **Testing:** Jest + Supertest

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database (or a free [Neon](https://neon.tech) instance)

### Setup

```bash
# clone the repo
git clone https://github.com/jeetnik/Bitespeed-Backend.git
cd Bitespeed-Backend

# install dependencies
npm install

# set up environment variables
cp .env.example .env
# edit .env and add your database URL

# run migrations
npx prisma migrate dev

# start the dev server
npm run dev
```

The server will start on `http://localhost:3000`.

## API

### `POST /identify`

Accepts a JSON body with at least one of `email` or `phoneNumber`:

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Returns the consolidated contact:

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

### How It Works

- If no matching contact exists, a new **primary** contact is created.
- If the request shares an email or phone with an existing contact but has new info, a **secondary** contact is created and linked to the primary.
- If the request links two separate primary contacts, the older one stays primary and the newer one is demoted to secondary.

## Running Tests

```bash
npm test
```

Tests are idempotent — they clean the database before running, so no manual reset is needed.

### Test Cases

| # | Test | What it checks |
|---|---|---|
| 1 | New customer | Creates a primary contact with empty secondaries |
| 2 | Same phone, new email | Creates a secondary linked to the existing primary |
| 3 | Phone-only lookup | Returns the full consolidated contact group |
| 4 | Secondary email lookup | Returns the full group from a secondary's email |
| 5 | Primary email lookup | Returns the full group from the primary's email |
| 6 | Duplicate request | Does not create extra contact rows |
| 7 | Two separate primaries | George and Biff created independently |
| 8 | Primary merging | Older primary wins, newer is demoted to secondary |
| 9 | Empty body | Returns 400 validation error |
| 10 | Null fields | Returns 400 validation error |

## Project Structure

```
src/
├── index.ts                 # Express server
├── db.ts                    # Prisma client
├── routes/
│   └── identify.ts          # POST /identify handler
├── services/
│   └── contactService.ts    # Reconciliation logic
└── lib/
    ├── validation.ts        # Zod schemas
    ├── ApiResponse.ts       # Response wrapper
    ├── CustomError.ts       # Error class
    └── asyncHandler.ts      # Async error handler
tests/
└── identify.test.ts         # Jest test suite
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled production build |
| `npm test` | Run Jest tests |
