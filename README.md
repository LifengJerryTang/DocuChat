# DocuChat API

AI-powered document chat backend — built throughout the **MasteringBackend AI Backend Engineer Bootcamp**.

Upload documents, ask questions, and receive AI-generated answers with source citations — powered by a RAG (Retrieval-Augmented Generation) pipeline.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express 5 |
| Database | SQLite (dev) → PostgreSQL (prod) via Prisma ORM |
| Auth | JWT access tokens + refresh token rotation |
| Validation | Zod |
| AI / RAG | OpenAI API + vector embeddings |
| Testing | Vitest + Supertest |
| Logging | Winston |
| API Docs | Swagger UI |
| CI | GitHub Actions |

---

## Bootcamp Roadmap

| Week | Topic | Status |
|---|---|---|
| **Week 1** | Project setup, database schema, authentication, REST API, error handling, testing | ✅ Complete |
| **Week 2** | RBAC, background jobs, external API integration, webhooks | 🚧 In Progress |
| **Week 3** | File uploads, document processing pipeline, chunking | 🔜 |
| **Week 4** | RAG pipeline — embeddings, vector search, LLM integration, citations | 🔜 |
| **Week 5** | Observability, AI tracing, performance optimisation, production hardening | 🔜 |

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd DocuChat
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_ACCESS_SECRET="your-secret-at-least-32-characters-long"
JWT_REFRESH_SECRET="your-refresh-secret-at-least-32-characters-long"
NODE_ENV="development"
PORT=3000
```

Additional variables added as the bootcamp progresses (OpenAI key, vector DB URL, etc.).

### 3. Run database migrations and seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Seeds two test users:

| Email | Password | Tier |
|---|---|---|
| `admin@docuchat.dev` | `Admin123!` | enterprise |
| `test@docuchat.dev` | `Test1234!` | free |

### 4. Start the development server

```bash
npm run dev
```

Server at `http://localhost:3000` · Swagger docs at `http://localhost:3000/api-docs`

---

## API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Login → `accessToken` + `refreshToken` |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token |
| `POST` | `/api/v1/auth/logout` | Invalidate a refresh token |

### Documents *(Bearer token required)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/documents` | List documents (paginated) |
| `POST` | `/api/v1/documents` | Upload a document |
| `GET` | `/api/v1/documents/:id` | Get a document |
| `DELETE` | `/api/v1/documents/:id` | Delete a document + its chunks |

### Conversations *(Bearer token required)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/conversations` | List conversations |
| `POST` | `/api/v1/conversations` | Start a conversation |
| `GET` | `/api/v1/conversations/:id/messages` | Get messages |
| `POST` | `/api/v1/conversations/:id/messages` | Send a message |

### Admin *(requires `roles:manage` permission — admin only)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/roles` | List all roles with permissions and user counts |
| `POST` | `/api/v1/admin/users/:userId/roles` | Assign a role to a user |
| `DELETE` | `/api/v1/admin/users/:userId/roles/:roleName` | Revoke a role from a user |

### Health

```
GET /health
```

---

## Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Invalid credentials" } }

// Validation error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

---

## Running Tests

```bash
# One-time: set up the test database
DATABASE_URL="file:./test.db" npx prisma migrate deploy

# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Test structure

```
src/services/__tests__/
  auth.service.test.ts     ← unit tests (mocked Prisma)

tests/
  helpers/setup.ts         ← resetDatabase(), createTestUser()
  integration/
    auth.test.ts           ← HTTP integration tests
```

---

## Project Structure

```
DocuChat/
├── prisma/
│   ├── schema.prisma        # User, Document, Chunk, Conversation, Message, UsageLog, AITrace
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── app.ts               # Express app (importable by tests)
│   ├── server.ts            # listen() + graceful shutdown
│   ├── config/              # env config + Swagger
│   ├── events/              # domain events
│   ├── lib/
│   │   ├── errors.ts        # AppError subclasses
│   │   ├── prisma.ts        # singleton client
│   │   ├── tokens.ts        # JWT helpers
│   │   └── password.ts      # bcrypt helpers
│   ├── middleware/
│   │   ├── auth.ts          # JWT auth
│   │   ├── authorize.ts     # RBAC
│   │   ├── validate.ts      # Zod validation
│   │   └── errorHandler.ts  # global error handler
│   ├── routes/
│   ├── services/
│   └── validators/
├── tests/
│   ├── helpers/
│   └── integration/
└── .github/workflows/ci.yml
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | `file:./prisma/dev.db` or PostgreSQL URL |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars |
| `NODE_ENV` | ✅ | `development` / `test` / `production` |
| `PORT` | ❌ | Defaults to `3000` |
| `OPENAI_API_KEY` | Week 4 | Required for RAG features |

---

## CI/CD

GitHub Actions on every push/PR to `main`:

1. `npm ci`
2. `prisma generate`
3. `prisma migrate deploy` (fresh SQLite test DB)
4. `npm run test:coverage`
5. Upload coverage artifact
