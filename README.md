# SERS - نظام السجلات التعليمية الذكي
## Smart Educational Records System

> A comprehensive digital platform for Saudi Ministry of Education employees to build, manage, and share professional performance portfolios (ملف الإنجاز الوظيفي) aligned with official evaluation standards.

---

## Project Overview

SERS enables teachers, school principals, counselors, and other educational staff to:

- Build structured performance portfolios mapped to official Ministry of Education criteria (11 standards, 45+ indicators)
- Upload evidence files (images, PDFs, videos, links) with AI-powered auto-classification
- Export professional PDF/DOCX reports with Ministry of Education visual identity
- Share portfolios via secure, time-limited links
- Manage templates and themes from an admin dashboard
- Work offline with automatic sync when connectivity is restored

### Supported Job Roles

| Role | Standards |
|------|-----------|
| معلم / معلمة | 11 معيار، 45 مؤشر |
| مدير المدرسة | 19 بند |
| وكيل المدرسة | 19 بند |
| الموجه الطلابي | 13 بند |
| الموجه الصحي | 14 بند |
| رائد النشاط | 15 بند |
| محضر المختبر | 13 بند |
| معلمة رياض الأطفال | 19 بند |
| المشرف التربوي | 8 بند |
| معلم تربية خاصة | 11 معيار |
| أمين مصادر التعلم | بنود مخصصة |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS 4 + Radix UI |
| Routing | Wouter |
| State / API | tRPC 11 + TanStack Query 5 |
| Backend | Express 4 + Node.js |
| Database | MySQL / TiDB via Drizzle ORM |
| Auth | JWT sessions + OAuth (optional) |
| Storage | AWS S3 via Forge API proxy |
| AI | OpenAI-compatible API (Gemini 2.5 Flash) |
| PDF Export | Puppeteer (server-side) + html2canvas (client-side) |
| DOCX Export | docx library + Puppeteer screenshot |
| Testing | Vitest |

---

## Project Structure

```
sers-preview/
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/           # Route-level page components
│   │   ├── components/      # Shared UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities (PDF export, QR, data)
│   │   ├── contexts/        # React contexts (Theme)
│   │   └── _core/           # Auth hook
├── server/                  # Express backend
│   ├── _core/               # Server infrastructure (tRPC, auth, LLM, env)
│   ├── routers.ts           # All tRPC API endpoints
│   ├── db.ts                # Database access layer
│   ├── storage.ts           # S3 file upload/download
│   ├── pdf-renderer.ts      # Puppeteer PDF generation
│   └── docx-renderer.ts     # DOCX generation
├── shared/                  # Shared types and constants
├── drizzle/                 # Database schema and migrations
└── .env                     # Environment variables (see below)
```

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- MySQL 8+ or TiDB (optional - app works locally without it)

### 1. Install Dependencies

```bash
pnpm install
```

> Note: `postinstall` automatically downloads Puppeteer's Chrome binary.

### 2. Configure Environment Variables

Copy the template and fill in your values:

```bash
cp .env.example .env
```

See the [Environment Variables](#environment-variables) section below.

### 3. Run Database Migrations (optional)

Only needed if `DATABASE_URL` is configured:

```bash
pnpm db:push
```

### 4. Start Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### 5. Build for Production

```bash
pnpm build
pnpm start
```

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ─── Server ───────────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ─── Auth / Session ───────────────────────────────────────
# Required: used to sign JWT session tokens
JWT_SECRET=your-strong-secret-here

# Required: used to sign session cookies
COOKIE_SECRET=your-cookie-secret-here

# ─── OAuth (optional) ─────────────────────────────────────
# Leave empty to disable OAuth login. App works without it.
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
VITE_APP_ID=

# ─── Database (optional) ──────────────────────────────────
# MySQL connection string. Leave empty to use localStorage only.
# Example: mysql://user:password@localhost:3306/sers_db
DATABASE_URL=

# ─── AWS S3 (optional) ────────────────────────────────────
# Leave empty to disable cloud file uploads. Files saved to IndexedDB locally.
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=

# ─── AI / LLM (optional) ──────────────────────────────────
# OpenAI-compatible API. Leave empty to disable AI features.
# Default endpoint: https://forge.manus.im/v1/chat/completions
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=

# ─── Analytics (optional) ─────────────────────────────────
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

### Graceful Degradation

The app is designed to work without any external services:

| Service | Without credentials |
|---------|-------------------|
| Database | Data saved in localStorage / IndexedDB |
| S3 Storage | Files saved in browser IndexedDB |
| AI Features | AI buttons show a clear Arabic error message |
| OAuth | Login page is skipped, app runs unauthenticated |

---

## API Endpoints

All API calls go through tRPC at `/api/trpc`. Key routers:

| Router | Procedures | Auth |
|--------|-----------|------|
| `auth.me` | Get current user | Public |
| `auth.logout` | Clear session | Public |
| `portfolio.*` | CRUD for portfolios | Protected |
| `file.upload` | Upload evidence file to S3 | Protected |
| `share.*` | Create/view share links | Mixed |
| `admin.*` | Review portfolios | Admin only |
| `templates.*` | PDF template management | Mixed |
| `userThemes.*` | Custom theme management | Protected |
| `ai.classifyEvidence` | AI evidence classification | Public |
| `ai.suggestEvidence` | AI content suggestions | Public |
| `ai.fillFormFields` | AI form auto-fill | Public |
| `ai.improveText` | AI text improvement | Public |
| `ai.analyzeGaps` | AI gap analysis | Public |
| `genAI.*` | Reports, radio, CV, exams | Public |

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/export-pdf` | Server-side PDF via Puppeteer |
| POST | `/api/export-docx` | Server-side DOCX export |
| GET | `/api/image-proxy?url=` | CORS proxy for images in PDF export |
| GET | `/api/oauth/callback` | OAuth authorization callback |

---

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with feature cards |
| `/performance-evidence` | PerformanceEvidence | Main portfolio builder |
| `/certificates` | CertificateBuilder | Certificate generator |
| `/grade-analysis` | GradeAnalysis | Grade analysis tool |
| `/covers` | CoverBuilder | Cover page builder |
| `/treatment-plans` | TreatmentPlan | Treatment plan forms |
| `/portfolio-builder` | PortfolioBuilder | Portfolio management |
| `/report-center` | ReportCenter | Report generation hub |
| `/school-radio` | SchoolRadio | AI school radio script generator |
| `/smart-cv` | SmartCV | AI-powered CV builder |
| `/exam-builder` | ExamBuilder | Exam question builder |
| `/store` | Store | Template store |
| `/admin` | AdminDashboard | Admin review dashboard |
| `/template-manager` | TemplateManager | PDF template management |
| `/shared/:token` | SharedPortfolio | Public portfolio viewer |
| `/template/:token` | SharedTemplate | Public template viewer |

---

## Database Schema

Six tables managed by Drizzle ORM:

- `users` - User accounts (openId, name, email, role)
- `portfolios` - Performance portfolios (jobId, criteriaData JSON, status)
- `uploaded_files` - S3 file references (fileKey, url, mimeType)
- `share_links` - Temporary share tokens (expiresAt, viewCount, password)
- `pdf_templates` - Admin-managed PDF templates (colors, layout JSON)
- `user_themes` - User custom themes (themeData JSON)

---

## Testing

```bash
# Run all tests (Vitest)
pnpm test
```

The test suite covers: AI classification, portfolio CRUD, share links, admin review, PDF templates, evidence upload, and offline sync logic.

---

## Known Limitations & Roadmap

### Current Limitations

- Share link passwords are stored as plaintext (no bcrypt hashing yet)
- No rate limiting on public AI endpoints
- No database indexes on foreign keys (performance impact at scale)
- Offline sync queue marks actions as synced without calling the API (placeholder)

### Recommended Production Improvements

**Security**
- Add bcrypt hashing for share link passwords
- Add rate limiting middleware (e.g., `express-rate-limit`) on AI and export endpoints
- Add CSRF protection for state-changing requests
- Validate and sanitize all JSON column inputs

**Performance**
- Add database indexes on `portfolios.userId`, `uploadedFiles.portfolioId`, `shareLinks.token`
- Implement Redis caching for frequently-read templates
- Use streaming for large PDF exports instead of buffering in memory

**Features**
- Implement actual API calls in `useOfflineSync.syncPendingActions()`
- Add conflict resolution for concurrent portfolio edits
- Add audit logging for admin actions
- Add soft deletes to preserve data history
- Add email notifications for portfolio review status changes

**Infrastructure**
- Add health check endpoint (`/api/health`)
- Add structured logging (e.g., pino)
- Add environment variable validation with Zod on startup
- Move Puppeteer to a separate microservice for better resource isolation
