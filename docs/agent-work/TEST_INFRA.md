# SERS Opaque-Box E2E Test Infrastructure & Tiers 1–4 Suite (`TEST_INFRA.md`)

**Role:** Role 9 — QA & Independent Reviewer / Test Architect  
**Target Execution Branch:** `reconcile/pr41-pr40-2026-11-24` (`C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview-reconcile`)  
**Authoritative Requirement Sources:**  
1. `ORIGINAL_REQUEST.md` (`R1–R5`, Acceptance Criteria)  
2. `PROJECT.md` § Feature Inventory (15 functional features `#1–#15`, `N = 15`)  
3. `REQUIREMENTS_CATALOG_AND_MATRIX.md` (`Reconciliation:R01–R22`, `Blueprint:*`, `P0-001–035`, `F01–F20`, `J01–J10`, `CONV-01–12`)  
4. Role 5 Design-Gate Checklist (`DG-01..DG-12`) & Role 4 System Contracts  

---

## 1. Test Methodology & Quantitative Coverage Targets (`N = 15`)

All tests in this suite are **requirement-driven opaque-box tests**: expected outputs are derived strictly from requirement invariants, Zod/API contracts, Arabic RTL/WCAG 2.2 AA rules, and document acceptance invariants—never reverse-engineered from implementation internals.

Counting the **N = 15** functional features in `PROJECT.md § Feature Inventory` (`#1` through `#15`, excluding `#16` E2E Suite and `#17` Final Acceptance):

| Tier | Methodology | Minimum Threshold | Designed Count | Focus |
|---|---|---|---|---|
| **Tier 1** | Category-Partition Happy Paths & Basic Contracts (Progressive) | `>= 5 * N = 75` | **75** (5 per feature) | Primary user/system journeys from earliest milestone `M1` onward |
| **Tier 2** | BVA, Adversarial Encoding/Escaping, Invalid Combos & Error Recovery | `>= 5 * N = 75` | **75** (5 per feature) | Boundaries (`0`, `1`, `max`, `max+1`), RTL/bidi, CAS races, revocation, IDOR, `360px`/`390px`/`1440px`, WCAG 2.2 AA |
| **Tier 3** | Pairwise Cross-Feature Combinatorial Matrix | `>= N = 15` | **18** | Multi-factor interactions (`ownerType × yearContext × template/schema × provenance × review × output × viewport × AI policy`) |
| **Tier 4** | Real-World Educator & School Workloads | `>= max(5, ceil(N/2)) = 8` | **10** | Full multi-step Saudi teacher, principal, reviewer, store/AI, and outsider/revocation journeys |

---

## 2. Environment Classification & Execution Matrix (Local Dev vs Staging/CI)

Every test case is tagged with exactly one **Execution Environment**:

| Tag | Runtime Requirements | Runnable Locally on Windows Dev (`sers-preview-reconcile`)? | Command Pattern |
|---|---|---|---|
| `LOCAL-HERMETIC` | Node + Vitest (in-memory/pure TS, no DB, no external services) | **YES** (note local Node `v24.14.1` vs `engines.node >=22.12 <23` caveat) | `pnpm exec vitest run <file>` |
| `LOCAL-BROWSER` | Node (`tsx --test`) + built `dist/public` + local Express HTTP fixture server + Puppeteer Chromium (`data:` URLs only; external requests aborted). Does **NOT** require `GITHUB_ACTIONS=true` or MySQL. | **YES** (requires `pnpm build` + cached Puppeteer Chromium) | `pnpm exec tsx --test tests/e2e/<suite>.mts` |
| `STAGING-MYSQL` | `LOCAL-BROWSER` / Vitest + disposable MySQL 8.4 (`SERS_INTEGRATION=1`, `assertDisposableMySQL()`) + `drizzle-kit migrate` | **NO** on current local Windows host (no MySQL in PATH); **YES** in Linux CI / Docker Compose staging | `SERS_INTEGRATION=1 pnpm exec vitest run <file>` |
| `STAGING-FULL` | MySQL 8.4 + ClamAV (`3310`) + `qpdf` + `poppler-utils` (`pdftotext`/`pdffonts`/`pdftoppm`) + LibreOffice `soffice` + synthetic OIDC/AI HTTP harness | **NO** locally (missing MySQL, ClamAV, `qpdf`, `poppler-utils`, `soffice`); **YES** in CI `integration.yml` / Ubuntu staging | `SERS_INTEGRATION=1 SERS_SCANNER_INTEGRATION=1 pnpm exec tsx --test <file>` |
| `MANUAL-UAT` | Real Microsoft Word desktop, physical A4 printer, smartphone camera QR scanner, NVDA/VoiceOver screen reader, 5+3 educator UAT (`P0-024`) | **Manual Gate** (explicitly tracked in `RESUME.md`, never faked by synthetic scripts) | Manual checklist |

---

## 3. Existing Harness Integration & Zero-Duplication Policy

### 3.1 Existing Assets to Preserve & Extend (Never Duplicate)
| Existing File (`70ee7d6` / `1e8a4e4`) | What It Already Covers | E2E Track Action (Zero Duplication) |
|---|---|---|
| `server/work-version-*.test.ts`, `output-wire-boundary.test.ts`, `portfolio-version-guard.test.ts`, `report-stale.test.ts`, `ai-data-policy.test.ts`, `arabic-ux.test.ts` | Unit invariants, wire redaction AST check, stale comparison, PII redaction | Keep untouched except updating `portfolio-version-guard.test.ts` in M3 when `R08` unlocks typed portfolio versions, and adding `reportIdentity` + `R12` unit specs |
| `tests/browser/public-output.mts` | `/output/:token` HTTP fixture E2E (mobile `390px`, password, revocation, navigation race, retry) | Keep as canonical public-viewer browser gate (`ci.yml`); add `360px` + `institution` banner assertions in `tests/e2e/m1-rtl-responsive-wcag.mts` |
| `tests/browser/report-editor.mts` (`PR40`) | Mobile `390px`/`320px` back button, load/review retry, CAS save race, QR share modal, `EvidenceLibrary` Radix Dialog | Port into `sers-preview-reconcile`, upgrade fixture to `schemaVersion: 2` + `reportIdentity` tab click + `360px` check |
| `tests/browser/account-mysql.mts`, `auth-mysql.mts`, `share-mysql.mts`, `evidence-mysql.mts`, `ai-safety.mts` | Full MySQL + ClamAV + OAuth + AI browser journeys in `integration.yml` | Keep `GITHUB_ACTIONS === "true"` assertions for CI safety; add new opaque-box MySQL E2E cases in `tests/e2e/*-mysql.mts` gated on `SERS_INTEGRATION=1` + `assertDisposableMySQL()` |
| `scripts/verify-work-version-outputs.ts`, `verify-report-identity.ts`, `verify-report-numerals.ts`, `verify-word-cover.ts` | Poppler PDF text/font/bounds/QR + LibreOffice cover layout | Port PR #40 scripts in M1; update `verify-report-identity.ts` to cover BOTH `schemaVersion: 2` typed `reportIdentity` and legacy PR #40 `fields` extraction |

### 3.2 Target E2E Suite Layout (Inside `sers-preview-reconcile`, NOT `.agents/teamwork/`)
- `tests/e2e/helpers/opaque-fixture-server.ts` — Shared deterministic Express + superjson tRPC mock server + dynamic ephemeral port (`listen(0, "127.0.0.1")`) + isolated `BrowserContext` factory + `360x740` / `390x844` / `1440x900` viewport helpers + WCAG touch-target/contrast/focus probes.
- `tests/e2e/helpers/mysql-e2e-harness.ts` — Wraps `assertDisposableMySQL()`, creates ephemeral synthetic users/orgs per test (`randomUUID()`), closes DB pool & server cleanly in `finally`.
- `tests/e2e/m1-report-identity-outputs.e2e.mts` (`LOCAL-BROWSER`) — M1: `reportIdentity` + `schemaVersion: 2` + `PDF/DOCX` deterministic JSZip/renderer checks + `DG-01/07/08/09/10/11/12`.
- `tests/e2e/m2-onboarding-ownership.e2e.mts` (`LOCAL-BROWSER` + `STAGING-MYSQL` split) — M2: `WorkHub` 0-year/0-org onboarding, school profile auto-fill, personal-vs-org isolation.
- `tests/e2e/m3-work-graph-completion.e2e.mts` (`LOCAL-BROWSER` + `STAGING-MYSQL` split) — M3: `R12` template switch/rollback, `R08` dynamic portfolio, `R04` `Used-in`/safe-delete, `J08` legacy import, `R21` version restore, `CONV-05` preflight.
- `tests/e2e/m4-standards-eval-store-ai.e2e.mts` (`LOCAL-BROWSER` + `STAGING-MYSQL` split) — M4: `R14` standards registry, `R09` self-eval & plans, `R13` sandbox store/entitlements, `R06/R20` AI privacy & provenance, `R5` quarantine.
- `tests/e2e/tier3-pairwise-and-tier4-workloads.e2e.mts` (`STAGING-FULL` with `LOCAL-BROWSER` subset) — Tiers 3 & 4 end-to-end workloads.

### 3.3 Anti-Flakiness Rules (Mandatory for All New Tests)
1. **No fixed sleeps (`setTimeout`)**: Wait only via `page.waitForFunction`, `page.waitForSelector`, or `page.waitForResponse`.
2. **Ephemeral Ports & Isolated Contexts**: Always `app.listen(0, "127.0.0.1")` and `browser.createBrowserContext()` per actor (`owner`, `member`, `reviewer`, `outsider`) so cookies/localStorage never bleed across actors or parallel runs.
3. **Hermetic Font/Network Determinism**: Call `await page.evaluate(() => document.fonts.ready)` before layout/bounding-rect assertions; abort non-loopback/non-`data:` requests in browser render checks.
4. **No `GITHUB_ACTIONS` gate on local E2E**: Local `LOCAL-BROWSER` tests MUST pass on developer Windows/macOS/Linux workstations without `GITHUB_ACTIONS=true`.

---

## 4. Progressive Milestone Testability Schedule

| Milestone | Features Unlocked (`PROJECT.md #`) | Tests Runnable & Passing at End of Milestone |
|---|---|---|
| **M1** | `#1` (Reconciliation & Renderers), `#2` (Traceability Docs), `#9` (Review/Outputs/QR baseline), `#14` (RTL/Chrome/Mobile baseline), `#15` (Wire/Security baseline) | All M1-tagged Tier 1 (20 cases), Tier 2 (20 cases), Tier 3 (`P01..P04`), Tier 4 (`W01`, `W02`) |
| **M2** | `#3` (Personal Onboarding), `#4` (Membership, Ownership & Profile Auto-Fill) | M1 + all M2-tagged Tier 1 (+10), Tier 2 (+10), Tier 3 (`P05..P08`), Tier 4 (`W03`, `W04`) |
| **M3** | `#5` (Template Switch `R12`), `#6` (Dynamic Portfolio `R08`), `#7` (`Used-in` & Gap Check), `#8` (Version Restore & Legacy Import), `#9` (Preflight `CONV-05`) | M1–M2 + all M3-tagged Tier 1 (+20), Tier 2 (+20), Tier 3 (`P09..P13`), Tier 4 (`W05..W07`) |
| **M4** | `#10` (`standard_versions`), `#11` (Self-Eval & Plans), `#12` (Store Sandbox), `#13` (AI Privacy & Quarantine), `#14` (Full `360px`/`390px`/`1440px` + WCAG), `#15` (Full Ops/Retention) | 100% of Tiers 1–4 (`75 + 75 + 18 + 10 = 178` opaque-box test cases) |
| **M5** | `#16` + `#17` | 100% Tiers 1–4 + Tier 5 Adversarial + `MANUAL-UAT` sign-off -> `RESUME.md` |

---

## 5. Tier 1 Test Matrix — Core Smoke, Happy Paths & Basic Contracts (`75` Cases, `5` per Feature `#1..#15`)

| ID | Feat # | Milestone | Env | Input / Precondition | Expected Output (Requirement-Derived) |
|---|---|---|---|---|---|
| `T1-01-01` | #1 | M1 | `LOCAL-HERMETIC` | `schemaVersion: 2` draft + typed `reportIdentity` (`schoolName`, `reportPreparer`, `ministryLogo: true`) | `normalizeReportDraft` & `projectReportDocument` succeed; `model.reportIdentity` populated; `model.fields` excludes identity keys |
| `T1-01-02` | #1 | M1 | `LOCAL-HERMETIC` | Legacy PR #40 snapshot with `fields.reportIdentityVersion = "1"` & `schoolLogoPng` | Transparently extracts into `reportIdentity`; body `model.fields` remains clean without throwing `Unknown report field` |
| `T1-01-03` | #1 | M1 | `LOCAL-BROWSER` | Render PDF HTML & DOCX with `Cairo`, `Tajawal`, `Noto Kufi Arabic` + `1448–1449`, `١٤٤٨–١٤٤٩`, `۱۴۴۸–۱۴۴۹` | Bundled `@font-face` / `.odttf` embedded; `<bdo dir="ltr">` & `<w:bidi w:val="0"/>` preserve start-year on left, end-year on right |
| `T1-01-04` | #1 | M1 | `STAGING-MYSQL` | `WorkVersion` with existing `r1..r5` PDF / `r1..r3` DOCX output + new `generatePrivatePdf` / `Docx` (`r6`/`r4`) | Old `outputId` remains downloadable; new generation produces `r6`/`r4` artifact with `reused: false` |
| `T1-01-05` | #1 | M1 | `LOCAL-BROWSER` | `WorkReportEditor` loads draft, edits identity + typed field, saves, creates version | Save increments `revision`; `WorkVersion` snapshot captures frozen `reportIdentity` & `fieldDefinitions` |
| `T1-02-01` | #2 | M1 | `LOCAL-HERMETIC` | Parse `READ_COVERAGE.md` & `REQUIREMENT_IMPLEMENTATION_MATRIX.md` in `sers-preview-reconcile` | Both files exist, contain qualified IDs (`Reconciliation:R01–R22`, `Blueprint:*`, `P0`, `A`, `J`, `F`, `REQ-WA`), and document PR #40/#41/#42 |
| `T1-02-02` | #2 | M1 | `LOCAL-HERMETIC` | Check `REQUIREMENT_IMPLEMENTATION_MATRIX.md` for the 8 Role-2 gaps | Explicitly records `WorkHub.tsx:49`, `PR40/41` schema conflict, renderer `r6/r4`, personal share deadlock, portfolio block, `R12` lock, `360px` check, updated Nov status |
| `T1-02-03` | #2 | M1 | `LOCAL-HERMETIC` | Check competitor benchmark coverage in docs | All 17 named Arabic/education competitors + 5 modern benchmarks documented with feature/differentiation notes |
| `T1-02-04` | #2 | M1 | `LOCAL-HERMETIC` | Check PR #42 status in reconciliation docs | PR #42 (`3204819`) explicitly marked superseded by PR #41 (`pnpm@10.34.9` + audit gate) |
| `T1-02-05` | #2 | M1 | `LOCAL-HERMETIC` | Verify `sers-preview` (`main`) & `SERS` remain untouched (`git status` / `git rev-parse`) | Zero modifications or untracked agent files in `sers-preview` (`main`) or `SERS` (`R5` constraint) |
| `T1-03-01` | #3 | M2 | `LOCAL-BROWSER` | Personal user (`0` orgs, `0` academic years) opens `/work`, types 3-char title, clicks `"إنشاء"` | Submit button is enabled (`!disabled`); modal uses Radix `<Dialog>`; creates `ownerType: "personal"` work with null `academicContext` |
| `T1-03-02` | #3 | M2 | `STAGING-MYSQL` | Personal user creates report without year/term, edits draft, creates `v1`, generates private PDF & DOCX | Full create -> draft -> version -> private PDF & DOCX succeeds with zero school membership |
| `T1-03-03` | #3 | M2 | `STAGING-MYSQL` | Personal user attaches `academicYearId` + `academicTermId` later via `work.update` | `workItems.academicYearId`, `academicTermId`, and `academicContext` snapshot update atomically |
| `T1-03-04` | #3 | M2 | `LOCAL-BROWSER` | Personal user views Share panel in `WorkReportEditor` | Displays calm Arabic guidance explaining personal works support private PDF/Word and school review is required for public links |
| `T1-03-05` | #3 | M2 | `LOCAL-BROWSER` | Personal user opens `WorkReportEditor` identity tab | Zero mandatory school fields; `schoolPrincipal` blank line omitted when empty; optional `"استخدام اسمي"` chip fills `reportPreparer` |
| `T1-04-01` | #4 | M2 | `STAGING-MYSQL` | User A creates org -> invites User B -> User B accepts -> User B creates org report | Org work has `creatorUserId = B`, `ownerType = "organization"`, `ownerOrganizationId = org.id` |
| `T1-04-02` | #4 | M2 | `STAGING-MYSQL` | User B creates org report then leaves/is suspended from org | User B loses all read/write/download access immediately while `creatorUserId` remains B on org record |
| `T1-04-03` | #4 | M2 | `LOCAL-BROWSER` | Org user clicks `"تعبئة بيانات المدرسة المحفوظة"` in `WorkReportEditor` | Auto-fills `schoolName`, `reportPreparer`, `schoolPrincipal`, `ministryLogo`, `schoolLogoPng` from school profile; allows per-draft override |
| `T1-04-04` | #4 | M2 | `STAGING-MYSQL` | Create sequential non-overlapping terms (1–3) in org academic year and bind to new work | Work captures immutable `academicContext`; changing year label later does not mutate existing `WorkVersion` |
| `T1-04-05` | #4 | M2 | `STAGING-MYSQL` | Owner promotes member to `reviewer` and assigns/creates org academic year | Role change persists; `reviewer` appears in `reviewSupport.reviewers` for org works |
| `T1-05-01` | #5 | M3 | `LOCAL-HERMETIC` | `previewTemplateSwitch` from `workshop-report` to `initiative-report` with populated shared & unique fields | Shared keys (`summary`, `objectives`, etc.) mapped `"exact"`; aliases mapped `"type_compatible"`; unmapped fields listed without loss |
| `T1-05-02` | #5 | M3 | `STAGING-MYSQL` | `switchTemplate` with `unmappedStrategy: "append_to_summary"` on `schemaVersion: 2` draft | `templateId`, `templateVersionId`, `fieldDefinitions` update at `revision + 1`; unmapped text preserved in `summary`; history entry written |
| `T1-05-03` | #5 | M3 | `STAGING-MYSQL` | `switchTemplate` with `unmappedStrategy: "preserve_hidden"`, followed by `reportDraft.save` | Hidden unmapped fields survive subsequent `save` calls without `Unknown report field` error |
| `T1-05-04` | #5 | M3 | `STAGING-MYSQL` | `rollbackTemplate` using `historyId` returned by `switchTemplate` | Restores exact prior `templateId`, `templateVersionId`, `fieldDefinitions`, `fields`, `reportIdentity` at `revision + 1` |
| `T1-05-05` | #5 | M3 | `LOCAL-BROWSER` | User changes template selector in `WorkReportEditor`, inspects preview modal, confirms switch | Dirty edits flush first; modal shows mapped/unmapped/new fields (`DG-05`); editor re-renders new typed fields cleanly |
| `T1-06-01` | #6 | M3 | `LOCAL-BROWSER` | User opens `WorkDetail` for `type: "portfolio"` in M1/M2 (pre-`R08`) vs M3 (post-`R08`) | Pre-M3: honest status notice, no empty review `<select>`; Post-M3: shows Green/Amber/Red readiness bar & composition sections |
| `T1-06-02` | #6 | M3 | `STAGING-MYSQL` | User creates typed portfolio draft referencing 2 existing versioned `WorkItem`s + 2 `Asset`s in same scope | Portfolio stores references (`workItemId`, `workVersionId`, `assetId`) with zero duplicate `assets` or `upload_intents` rows |
| `T1-06-03` | #6 | M3 | `STAGING-MYSQL` | User creates `WorkVersion` for `portfolio` via `portfolioDraftRouter.createVersion` | Pins each referenced work to its `workVersionId` and freezes image previews into immutable `work_versions.snapshot` |
| `T1-06-04` | #6 | M3 | `LOCAL-BROWSER` | Keyboard user reorders portfolio items using `↑` / `↓` buttons (`>=44x44px`) and saves | Order updates deterministically and persists across reload |
| `T1-06-05` | #6 | M3 | `LOCAL-BROWSER` | User uses guided opt-in importer in `PortfolioBuilder` (`/portfolio`) into cloud `WorkItem` (`portfolio`) | Preview shows items to import with PII summary; confirms and creates cloud portfolio without mutating localStorage unexpectedly |
| `T1-07-01` | #7 | M3 | `STAGING-MYSQL` | Link one `Asset` to 3 `WorkItem`s, call `domain.asset.usage` (`Used-in`) | Returns all 3 `activeLinks` (`workItemId`, `workTitle`, `workStatus`, `role`) + `historicalVersionCount` |
| `T1-07-02` | #7 | M3 | `STAGING-MYSQL` | `unlinkAssetFromWork` on Work #1 | Link row deleted for Work #1; `Asset` and links on Work #2/#3 remain intact |
| `T1-07-03` | #7 | M3 | `STAGING-MYSQL` | Safe delete `domain.asset.delete({ id, forceUnlinkActive: true })` after `WorkVersion` was frozen | Draft links unlinked, `assets.deletedAt` set, `uploadIntents.tombstonedAt` set; existing `WorkVersion` PDF/DOCX still renders frozen preview |
| `T1-07-04` | #7 | M3 | `LOCAL-BROWSER` | Compare scanned `ready` file vs `link`/`text` vs AI proposal in `EvidenceLibrary` & `WorkReportEditor` | Displays exact 3-badge provenance: `أصلي موثّق`, `مادة مساعدة`, `مسودة غير مؤكدة (AI)` |
| `T1-07-05` | #7 | M3 | `LOCAL-BROWSER` | User invokes Smart Gap Check ("ما الذي ينقص الشاهد؟") on draft work | Returns contextual suggestions marked `مسودة غير مؤكدة (AI)` without blocking manual submission |
| `T1-08-01` | #8 | M3 | `LOCAL-BROWSER` | Legacy `/reports/legacy` localStorage draft opened in guided `J08` importer | Preview & diff view shown before creating cloud `workItem`; zero silent auto-write on load |
| `T1-08-02` | #8 | M3 | `STAGING-MYSQL` | Confirm `J08` legacy draft import into new `schemaVersion: 2` `WorkItem` | Creates `WorkItem` + `report_document` `v2` preserving text and optional identity fields |
| `T1-08-03` | #8 | M3 | `STAGING-MYSQL` | Work has `v1` and `v2`; user views version diff and invokes `"استعادة كمسودة حالية"` on `v1` | Creates new head `revision + 1` matching `v1` draft content without deleting or mutating `v1` or `v2` snapshots |
| `T1-08-04` | #8 | M3 | `STAGING-MYSQL` | Restore `v1` as new head when `v1` had linked asset still active | Restored draft keeps active `evidenceAssetIds` and ignores soft-deleted assets gracefully with warning |
| `T1-08-05` | #8 | M3 | `LOCAL-BROWSER` | Two tabs open same report; Tab B saves `rev 2`; Tab A edits and hits CAS `conflict` | Conflict banner offers: Copy local edits, View field diff, and Confirm server reload (all working) |
| `T1-09-01` | #9 | M1 | `STAGING-MYSQL` | Org author requests review on `v1` from peer reviewer; reviewer approves | `reviews.status = "approved"`, `workItems.status = "approved"`, notification sent to author |
| `T1-09-02` | #9 | M1 | `STAGING-MYSQL` | Author creates public `link` & `qr` output on approved `v1`, then resolves `/output/:token` | Public projection returns title, fields, evidence metadata, and sanitized institution; zero `storageKey`/`ownerUserId` |
| `T1-09-03` | #9 | M1 | `STAGING-MYSQL` | Author creates `protected` share link with password, resolves with correct password | Wrong password -> `401`; correct password -> `200` + report; password never stored in `localStorage`/`sessionStorage`/URL |
| `T1-09-04` | #9 | M1 | `LOCAL-BROWSER` | `ReportShareActions` `restorePublication` on existing active output link | Restores same URL/token without creating a duplicate `outputs` row |
| `T1-09-05` | #9 | M3 | `LOCAL-BROWSER` | Run Document Preflight (`CONV-05`) before creating PDF/DOCX on draft with empty required/summary or unlinked assets | Preflight highlights empty sections / missing evidence warnings non-destructively; user can fix or proceed consciously |
| `T1-10-01` | #10 | M4 | `STAGING-MYSQL` | Seed official MOE/ETEC `standard_versions` (`authority`, `sourceUrl`, `effectiveFrom`, `roleScope`) | `standards.list` returns active versioned standards by role (`teacher`, `principal`, `school_evaluation`) |
| `T1-10-02` | #10 | M4 | `STAGING-MYSQL` | Link asset to `standardVersionId` v1 + `criterionKey` via `asset_standard_links` | Association persists; query by standard returns linked assets scoped to user/org |
| `T1-10-03` | #10 | M4 | `STAGING-MYSQL` | Publish `standard_versions` v2 with `effectiveFrom` future/current while portfolio pins v1 | Existing v1 portfolio/evaluation continues displaying v1 domains/indicators unchanged (`F17`) |
| `T1-10-04` | #10 | M4 | `LOCAL-BROWSER` | Standards selector in UI displays official source URL, effective dates, and version badge | Users can filter indicators by role and inspect suggested evidence types |
| `T1-10-05` | #10 | M4 | `STAGING-MYSQL` | Query standards across different roles (`teacher` vs `school_evaluation`) | Returns only standards matching `roleScope` or `"all"` |
| `T1-11-01` | #11 | M4 | `STAGING-MYSQL` | Org admin creates `EvaluationCycle` (`work_items.type = "self_evaluation"`) pinned to `standardVersionId` | Creates `WorkItem` + `evaluation_cycles` row reusing Work/Asset/Version/Review engines |
| `T1-11-02` | #11 | M4 | `STAGING-MYSQL` | Evaluator scores indicator with `ratingCode`, `scoreNumeric`, and non-empty `justificationText` | `indicator_assessments` saves; attachment count remains informational (does not override `scoreNumeric`) |
| `T1-11-03` | #11 | M4 | `STAGING-MYSQL` | Create `ImprovementPlan` (`work_items.type = "improvement_plan"`) linked to `sourceCycleId` with initiatives | Gap initiatives link to `indicatorKey`, target dates, and status (`planned` -> `in_progress`) |
| `T1-11-04` | #11 | M4 | `STAGING-MYSQL` | Create `OperationalPlan` (`work_items.type = "operational_plan"`) linked to `academicYearId` + KPIs | `operational_kpis` store baseline, target, current value, due date, and owner |
| `T1-11-05` | #11 | M4 | `STAGING-MYSQL` | Create `WorkVersion` & export PDF/DOCX for `self_evaluation` / `operational_plan` | Shared Work/Output pipeline produces A4 Arabic PDF/DOCX from immutable snapshot |
| `T1-12-01` | #12 | M4 | `STAGING-MYSQL` | With `SERS_COMMERCE_SANDBOX=1`, list `products` and complete sandbox checkout for a template product | Creates `purchases` (`state: "paid"`) + active `entitlements` row in same transaction |
| `T1-12-02` | #12 | M4 | `STAGING-MYSQL` | User views «قوالبي» (`My Templates`) and applies entitled template to a `WorkItem` | Succeeds via `reportDraft.switchTemplate`; non-destructive mapping preserves existing content |
| `T1-12-03` | #12 | M4 | `LOCAL-BROWSER` | In `/store`, when sandbox commerce is disabled/unconfigured, inspect UI | Shows honest «قريباً» / sandbox-free state with zero fake payment forms or real charges (`R5`) |
| `T1-12-04` | #12 | M4 | `STAGING-MYSQL` | Create org-owned `Entitlement` vs personal-owned `Entitlement` | Exclusive SQL `CHECK` enforces scope isolation; org member cannot apply personal-only entitlement to another user's private work |
| `T1-12-05` | #12 | M4 | `STAGING-MYSQL` | Existing `WorkItem` created with entitled template continues opening/exporting after entitlement expires/revoked (`D019`) | Frozen `schemaVersion: 2` `fieldDefinitions` allow reading/exporting existing works; only new template selection is gated |
| `T1-13-01` | #13 | M4 | `STAGING-FULL` | Invoke `ai.*` / `genAI.*` with `privacyConfirmation` acknowledged and text containing phone/ID/email | Server `ai-data-policy.ts` redacts PII before calling synthetic provider; response labeled `مسودة غير مؤكدة (AI)` |
| `T1-13-02` | #13 | M4 | `LOCAL-BROWSER` | AI panel displays `<AiPrivacyGate>` plaintext summary (`ما سيُرسل`, `الغرض`, `حماية`) + checkbox | Submit disabled until acknowledged; `"تخطي واستخدام الإدخال اليدوي"` keeps manual flow enabled |
| `T1-13-03` | #13 | M4 | `STAGING-FULL` | AI provider returns outage/500 or circuit breaker trips | UI shows non-blocking fallback notice; manual editing, draft save, and evidence upload remain 100% functional |
| `T1-13-04` | #13 | M4 | `LOCAL-BROWSER` | Navigate to `/catalog` and inspect 13 sections & legacy routes | Every legacy tool carries honest badge (`server`/`partial`/`local`/`catalog`/`planned`); zero LMS/gradebook/student-portal nav in core shell |
| `T1-13-05` | #13 | M4 | `STAGING-MYSQL` | Invoke `onlineExam.submit` with unique `attemptId` | Auto-scores objective questions, flags essays manual, returns score without exposing answer key in `view` |
| `T1-14-01` | #14 | M1 | `LOCAL-BROWSER` | Visit `/`, `/work`, `/work/:id`, `/work/:id/report`, `/evidence`, `/reviews`, `/account`, `/output/:token` at `360x740` | Zero horizontal overflow (`scrollWidth <= 361`), `dir="rtl"`, back button clickable via `elementFromPoint` |
| `T1-14-02` | #14 | M1 | `LOCAL-BROWSER` | Repeat all core routes at `390x844` and `1440x900` | At `390px`: single column + sticky `[التحرير \| معاينة A4]`; at `1440px`: `w-72` right sidebar + 2-column sticky preview |
| `T1-14-03` | #14 | M1 | `LOCAL-BROWSER` | Inspect `index.html` viewport, interactive button boxes, contrast tokens, `aria-current`, Radix `<Dialog>` | No `maximum-scale=1`; close/unlink/delete buttons `>=44x44px`; `bg-teal-700` & `text-slate-600/500`; Escape + focus return pass |
| `T1-14-04` | #14 | M1 | `LOCAL-BROWSER` | Inspect `WorkReportEditor` cover preview and PDF/DOCX with empty `reportIdentity` vs filled school identity | Personal mode shows zero `"SERS"` cover dominance and zero blank principal line; school mode shows logos/signers cleanly (`DG-01`) |
| `T1-14-05` | #14 | M4 | `LOCAL-BROWSER` | Trigger Loading, Empty, Error (with Retry), and Success states on every core route (`DG-12`) | Every route shows `role="status"` loading, empty CTA, `role="alert"` + working Retry button, and recovers on retry without page reload |
| `T1-15-01` | #15 | M1 | `LOCAL-HERMETIC` | Inspect `domain.output.*` and `ReportPdfActions.tsx` payloads/source | Zero `storageKey`, `contentHash`, `rendererVersion`, or `stored.url` exposed on tRPC wire or UI |
| `T1-15-02` | #15 | M1 | `STAGING-FULL` | Upload valid PNG/PDF/TXT via `evidenceUpload` -> ClamAV + `qpdf` + PNG re-encode -> download | Only `ready` scanned asset downloads with `Content-Disposition: attachment`; unauthenticated -> `401`; outsider -> `404` |
| `T1-15-03` | #15 | M1 | `STAGING-MYSQL` | Revoke public share output (`domain.output.revoke`) and verify `audit_logs` | `audit_logs` records `output.share_created` and `output.share_revoked` transactionally; public endpoint returns `404` immediately |
| `T1-15-04` | #15 | M1 | `LOCAL-HERMETIC` | Send oversized pre-auth body to HTTP admission middleware (`http-body-admission`) | Rejected early with `413` before full JSON/body memory allocation |
| `T1-15-05` | #15 | M4 | `STAGING-MYSQL` | Verify `runtime-health` / `runtime-observability` + Drizzle migration parity (`drizzle-kit generate`) | Health endpoint returns expected readiness status; `drizzle-kit generate` yields zero uncommitted drift |

---

## 6. Tier 2 Test Matrix — Adversarial, BVA, Escaping & Error Recovery (`75` Cases, `5` per Feature `#1..#15`)

| ID | Feat # | Milestone | Env | Adversarial / BVA Input | Expected Error / Boundary Behavior |
|---|---|---|---|---|---|
| `T2-01-01` | #1 | M1 | `LOCAL-HERMETIC` | `schemaVersion: 2` save with unknown key in `fields` (`fields: { summary: "ok", injectedKey: "x" }`) | Throws `ReportDocumentValidationError` / `BAD_REQUEST` (`Unknown report field`) |
| `T2-01-02` | #1 | M1 | `LOCAL-HERMETIC` | Caller sends BOTH `reportIdentity` AND `REPORT_IDENTITY_KEYS` inside `fields` (dual conflicting sources), OR sends `fields.schoolLogoPng` under `schemaVersion: 2` | Rejected cleanly with `BAD_REQUEST` (`ReportDraftValidationError`) — prevents `schoolLogoPng` smuggling past router sanitization |
| `T2-01-03` | #1 | M1 | `LOCAL-HERMETIC` | `schoolLogoPng` = corrupted PNG / `96_001` chars base64 / `321x321`px / non-RGBA colorType; `schoolName` with `"\"; } body { display:none"` + `\x00\x07` control chars | Router rejects malformed/oversized PNG with `BAD_REQUEST`; control chars stripped; CSS `@top-right` escapes `"`/`\` cleanly without breaking `@page` CSS |
| `T2-01-04` | #1 | M1 | `STAGING-MYSQL` | Snapshot selects image asset lacking `frozen` (`asset.preview` raw only), OR image asset is deleted/unlinked during `createVersion` TOCTOU | `assertFrozenEvidence` / `prepareEvidenceOutsideTransaction` lock recheck throws `ReportEvidenceFreezeError` (`CONFLICT`); zero partial version created |
| `T2-01-05` | #1 | M1 | `STAGING-MYSQL` | Revoke `r1` (or `r5`) PDF output for `WorkVersion`, then request `generatePrivatePdfForWorkVersion` at `r6` (and same `r1..r3` -> `r4` for DOCX) | Permanently blocked (`OutputArtifactUnavailableError`: `revoked`); renderer bump never resurrects revoked version outputs |
| `T2-02-01` | #2 | M1 | `LOCAL-HERMETIC` | Audit `REQUIREMENT_IMPLEMENTATION_MATRIX.md` for duplicate unqualified IDs (`R01` without `Reconciliation:`/`Blueprint:`) | Zero ambiguous unqualified IDs in matrix primary keys |
| `T2-02-02` | #2 | M1 | `LOCAL-HERMETIC` | Compare `REQUIREMENTS_STATUS.json` vs `REQUIREMENT_IMPLEMENTATION_MATRIX.md` on resolved items | Matrix explicitly notes where historical snapshot is superseded by verified PR #40/#41 code |
| `T2-02-03` | #2 | M1 | `LOCAL-HERMETIC` | Check `package-lock.json` & `.env*` tracking in `sers-preview-reconcile` | No tracked `.env` secrets; `pnpm-lock.yaml` remains sole authoritative lockfile |
| `T2-02-04` | #2 | M1 | `LOCAL-HERMETIC` | Check `READ_COVERAGE.md` completeness against `SERS_Handoff_2026-11-23/sources/` | Every source file/limitation (`COLLECTION_LIMITS_AR.md`) accounted for truthfully |
| `T2-02-05` | #2 | M1 | `LOCAL-HERMETIC` | Verify no `.agents/teamwork/` metadata or `AGENTS.md`/`GEMINI.md` leaked into repo working tree | Clean workspace hygiene |
| `T2-03-01` | #3 | M2 | `LOCAL-BROWSER` | `WorkHub.tsx` title input BVA: `""` (0 chars), `" "` (whitespace), `"أ"` (1 char), `"أب"` (2 chars), 255 chars, 256 chars | Disabled for `<2` trimmed chars; enabled at `2` chars; `maxLength=255` enforced in UI and Zod |
| `T2-03-02` | #3 | M2 | `STAGING-MYSQL` | Personal user passes `academicYearId` belonging to an organization (`ownerType: "personal"`) | Server rejects cross-scope `academicYearId` (`FORBIDDEN` / `AccountAccessError`) |
| `T2-03-03` | #3 | M2 | `STAGING-MYSQL` | Personal user passes `academicTermId` belonging to a *different* `academicYearId` | Server rejects mismatched year/term pair (`BAD_REQUEST`) |
| `T2-03-04` | #3 | M2 | `STAGING-MYSQL` | Personal user calls `domain.review.request` or `shareOutput.create` on personal work | Rejected cleanly (`BAD_REQUEST`); personal work remains isolated to private PDF/DOCX |
| `T2-03-05` | #3 | M2 | `STAGING-MYSQL` | User attempts `work.update` (attach `academicYearId`) on an `archived` personal work | Rejected with `CONFLICT` / `BAD_REQUEST` |
| `T2-04-01` | #4 | M2 | `STAGING-MYSQL` | Last active `owner` attempts to demote self or set status to `left`/`suspended` | Blocked with `CONFLICT` (last-owner protection invariant) |
| `T2-04-02` | #4 | M2 | `STAGING-MYSQL` | Org `admin` attempts to activate an `invited` membership without target user acceptance, or modify an `owner` | Blocked with `CONFLICT` / `FORBIDDEN` |
| `T2-04-03` | #4 | M2 | `STAGING-MYSQL` | Suspended/removed reviewer attempts to submit pending `review.decide` concurrently while owner suspends membership | Transaction locks `memberships` `.for("update")` and rejects reviewer with `FORBIDDEN` |
| `T2-04-04` | #4 | M2 | `STAGING-MYSQL` | Create academic terms with overlapping dates (`startsOn > endsOn`, term 2 overlapping term 1, or 4th term) | Rejected with `BAD_REQUEST`; sequential 1–3 term rule enforced |
| `T2-04-05` | #4 | M2 | `STAGING-MYSQL` | User from School A attempts IDOR read/update/link/download on School B's `WorkItem`, `Asset`, or `Output` | Rejected with `FORBIDDEN` / `NOT_FOUND` (zero existence leak for private downloads) |
| `T2-05-01` | #5 | M3 | `STAGING-MYSQL` | Direct `reportDraft.save` attempting to change `templateId` without calling `switchTemplate` | Rejected cleanly (`ReportDraftValidationError`), ensuring explicit mapping flow cannot be bypassed |
| `T2-05-02` | #5 | M3 | `STAGING-MYSQL` | `switchTemplate` called with stale `expectedRevision` (concurrent edit race) | Rejected with `CONFLICT`; zero partial template or history mutation |
| `T2-05-03` | #5 | M3 | `LOCAL-HERMETIC` | `append_to_summary` when `summary` is `19_800` chars + `500`-char unmapped field (`> 20_000` `maxLength`) | `previewTemplateSwitch` flags capacity overflow and never crashes `normalizeReportDraft` with unhandled length error |
| `T2-05-04` | #5 | M3 | `STAGING-MYSQL` | `rollbackTemplate` on `archived` work, OR with evicted (`>5` switches ago) / unknown `historyId`, OR stale `expectedRevision` | Rejected cleanly (`CONFLICT` / `NOT_FOUND`); draft left untouched |
| `T2-05-05` | #5 | M3 | `LOCAL-BROWSER` | User has unsaved dirty field text in `WorkReportEditor` and immediately switches template | Client flushes dirty edits before `previewTemplateSwitch`/`switchTemplate`; zero unsaved text lost |
| `T2-06-01` | #6 | M3 | `STAGING-MYSQL` | Call legacy `domain.work.createVersion` with raw untyped `snapshot` on `type: "portfolio"` | Still rejected (`BAD_REQUEST`), preserving `portfolio-version-guard` security invariant |
| `T2-06-02` | #6 | M3 | `STAGING-MYSQL` | Portfolio `referencedWorks` includes `portfolioWorkItemId` itself (self-cycle), or cross-scope `WorkItem`, or soft-deleted `WorkItem` | Rejected with `BAD_REQUEST` / `FORBIDDEN` |
| `T2-06-03` | #6 | M3 | `STAGING-MYSQL` | Portfolio `createVersion` when a referenced `WorkItem` has `0` `WorkVersion`s (Red readiness) | Deterministic rejection (`PRECONDITION_FAILED`/`BAD_REQUEST`) without mutating the referenced `WorkItem` |
| `T2-06-04` | #6 | M3 | `LOCAL-BROWSER` | Portfolio in `PortfolioBuilder` contains PII (`0501234567`, email) and user clicks `"استيراد إلى سجل أعمالي السحابي"` | Importer strips/flags PII in preview unless explicitly confirmed; zero automatic background upload |
| `T2-06-05` | #6 | M3 | `STAGING-MYSQL` | Referenced report publishes `v2` after portfolio `v1` was frozen | Portfolio `v1` remains pinned to referenced report `v1` snapshot (never drifts silently) |
| `T2-07-01` | #7 | M3 | `STAGING-MYSQL` | Link asset owned by Personal User A (or School A) to Work owned by School B (`sameOwnershipScope` false) | Rejected with `FORBIDDEN` (`domain-db.ts:258`) |
| `T2-07-02` | #7 | M3 | `STAGING-MYSQL` | Link asset with `javascript:alert(1)` or `file:///etc/passwd` URL | Rejected (`BAD_REQUEST` / `FORBIDDEN`); only `http://` / `https://` allowed |
| `T2-07-03` | #7 | M3 | `STAGING-MYSQL` | Call `domain.asset.delete({ id })` WITHOUT `forceUnlinkActive: true` when asset is linked to 2 active drafts | Throws `CONFLICT` with structured `Used-in` summary (`activeLinks`); nothing deleted |
| `T2-07-04` | #7 | M3 | `STAGING-MYSQL` | Attempt to delete or purge an `upload_intent` under `legalHold` | Blocked cleanly; file & tombstone invariants preserved |
| `T2-07-05` | #7 | M3 | `STAGING-MYSQL` | Attempt to set `provenanceType = "execution_proof"` on an AI-generated asset without human confirmation/upload | Blocked (`BAD_REQUEST` / `FORBIDDEN`); AI drafts cannot masquerade as execution proof |
| `T2-08-01` | #8 | M3 | `LOCAL-BROWSER` | `/reports/legacy` contains corrupted/malformed JSON or XSS payload `<script>` in localStorage | Guided `J08` importer handles parse error gracefully with recovery message and escapes all text |
| `T2-08-02` | #8 | M3 | `STAGING-MYSQL` | Restore `v1` as new head with stale `expectedRevision` or on `archived` work | Rejected with `CONFLICT`; `v1` and current head remain intact |
| `T2-08-03` | #8 | M3 | `STAGING-MYSQL` | Restore `v1` as new head when `v1` had a different `templateId` from `v2` (head) | Restored draft adopts `v1`'s `templateId`, `templateVersionId`, `fieldDefinitions`, and `fields` cleanly |
| `T2-08-04` | #8 | M3 | `LOCAL-BROWSER` | `WorkReportEditor` offline (`saveState === "offline"`) reloads page with encrypted backup in `localStorage` | Restores BOTH `fields` AND `reportIdentity` from user-scoped encrypted vault; blocks `createVersion` while offline/conflict |
| `T2-08-05` | #8 | M3 | `STAGING-MYSQL` | Rapid concurrent edits (`expectedRevision` mismatch between 2 requests) | Exactly one succeeds (`rev + 1`); second fails `CONFLICT` without overwriting first |
| `T2-09-01` | #9 | M1 | `STAGING-MYSQL` | Org author attempts self-review (`reviewerUserId === requestedByUserId`) or requests review on old `v1` when `v2` exists | Rejected (`BAD_REQUEST` / `CONFLICT`); only current version + distinct eligible peer allowed |
| `T2-09-02` | #9 | M1 | `STAGING-MYSQL` | Request `shareOutput.create` with unsupported `maxViews: 5` (`z.strictObject`), or on unapproved org `v1`, or `type: "docx"` public | Rejected (`BAD_REQUEST`); `audit_logs` has zero orphan share rows |
| `T2-09-03` | #9 | M1 | `LOCAL-BROWSER` | `ReportPdfActions` / `ReportShareActions` opened when `draft.revision > version.reportRevision` (stale) | Blocks export/share until user clicks `"متابعة النسخة القديمة على أي حال"`; exports frozen `v1` content |
| `T2-09-04` | #9 | M1 | `STAGING-MYSQL` | Brute-force wrong password on `/output/:token` (`publicOutput.resolve`) past rate limit | Returns `429` rate limit error without confirming password validity |
| `T2-09-05` | #9 | M3 | `LOCAL-BROWSER` | Preflight (`CONV-05`) runs on 0-byte/empty report or report with >180,000 chars | Flags exact blocker/warning before render rather than failing silently inside Puppeteer/DOCX |
| `T2-10-01` | #10 | M4 | `STAGING-MYSQL` | Link asset to non-existent `standardVersionId` or invalid `criterionKey` | Rejected (`NOT_FOUND` / `BAD_REQUEST`) |
| `T2-10-02` | #10 | M4 | `STAGING-MYSQL` | Link asset to an expired/superseded `standardVersionId` for a *new* draft vs viewing historical | New draft link rejected (or warns superseded); historical `WorkVersion` still displays old standard title |
| `T2-10-03` | #10 | M4 | `STAGING-MYSQL` | Non-admin teacher attempts to mutate/seed official `standard_versions` | Rejected with `FORBIDDEN` |
| `T2-10-04` | #10 | M4 | `LOCAL-HERMETIC` | `standard_versions` JSON with empty `domains` or missing `effectiveFrom` | Rejected by Zod schema validation |
| `T2-10-05` | #10 | M4 | `STAGING-MYSQL` | Duplicate `(assetId, standardVersionId, criterionKey)` link attempt | Idempotent or `CONFLICT` without creating duplicate rows |
| `T2-11-01` | #11 | M4 | `STAGING-MYSQL` | Submit `indicator_assessments` with empty/whitespace `justificationText` (`""` / `"   "`) | Rejected (`BAD_REQUEST`); mandatory rationale invariant (`NEXT-19`) enforced |
| `T2-11-02` | #11 | M4 | `STAGING-MYSQL` | Attach 10 evidence assets to an indicator without manual rating | `scoreNumeric` remains `null`/unscored (never auto-computed from attachment count) |
| `T2-11-03` | #11 | M4 | `STAGING-MYSQL` | Personal user (no org) attempts to create an org `EvaluationCycle` for School X | Rejected with `FORBIDDEN` |
| `T2-11-04` | #11 | M4 | `STAGING-MYSQL` | Attempt to introduce student roster / gradebook field or route on `self_evaluation` | Rejected / nonexistent (`R5` LMS boundary check) |
| `T2-11-05` | #11 | M4 | `STAGING-MYSQL` | `operational_kpis` invalid bounds (`targetValue < 0` or `dueDate` malformed or cross-org `ownerUserId`) | Rejected (`BAD_REQUEST` / `FORBIDDEN`) |
| `T2-12-01` | #12 | M4 | `STAGING-MYSQL` | Replay identical checkout webhook / `idempotencyKey` 5 times concurrently (`F15`) | Returns existing `paid` + `entitlement` state; exactly **1** `purchases` row and **1** `entitlements` row created |
| `T2-12-02` | #12 | M4 | `STAGING-MYSQL` | Purchase succeeds, then `reportDraft.switchTemplate` fails due to CAS conflict (`F16`) | `entitlements` row remains `status: "active"` in «قوالبي»; retrying apply does NOT re-charge |
| `T2-12-03` | #12 | M4 | `STAGING-MYSQL` | Attempt `sandbox` checkout when `SERS_COMMERCE_SANDBOX` is unset / `NODE_ENV=production` | Rejected with `PRECONDITION_FAILED` / `FORBIDDEN` (`R5` zero real spend) |
| `T2-12-04` | #12 | M4 | `STAGING-MYSQL` | Non-entitled user attempts to apply a paid template (`templateId`) via `switchTemplate` or `reportDraft.save` | Rejected with `FORBIDDEN` (`Payment/Entitlement required`) |
| `T2-12-05` | #12 | M4 | `STAGING-MYSQL` | Refund/revoke an `entitlement` then attempt creating a *new* work with that template | Blocked (`FORBIDDEN`), while existing `WorkVersion`s remain readable/exportable (`D019`) |
| `T2-13-01` | #13 | M4 | `STAGING-FULL` | Call `ai.generateCV` / `extractGradesFromImage` / `classifyEvidence` (image) WITHOUT `privacyConfirmation.acknowledged = true` | Rejected with `PRECONDITION_FAILED`; zero outbound call to AI provider |
| `T2-13-02` | #13 | M4 | `STAGING-FULL` | Upload image to AI when `SERS_AI_IMAGE_POLICY_*` operator gate is missing/unconfigured | Rejected with `PRECONDITION_FAILED`; UI keeps manual entry active; zero `image_url` sent |
| `T2-13-03` | #13 | M4 | `STAGING-FULL` | Exceed per-user minute/daily `ai_request_budgets` or send oversized payload (`> max`) | Rejected with `429` / `413`; existing manual work/draft untouched |
| `T2-13-04` | #13 | M4 | `STAGING-MYSQL` | Submit `onlineExam` 10 times concurrently with identical `attemptId` vs different student reusing `attemptId` | Identical retry deduplicates cleanly; different student/answers fails with `CONFLICT`; rate limit returns `429` |
| `T2-13-05` | #13 | M4 | `STAGING-MYSQL` | Call disabled legacy `file.upload` or `templates.uploadImage` | Fails with `PRECONDITION_FAILED` (hardened quarantine) |
| `T2-14-01` | #14 | M1 | `LOCAL-BROWSER` | Open `ReportPdfActions` and `ReportShareActions` sequentially on `360x740` viewport | Opening Share closes PDF (mutually exclusive); panels fit `100dvh` with reachable `[X]` (`>=44x44px`) and `break-all` URL |
| `T2-14-02` | #14 | M1 | `LOCAL-BROWSER` | Render extreme unspaced Arabic word (`"تقريرعربيطويل".repeat(12)`) + LTR URL in `WorkReportEditor` at `360px` | Wraps cleanly via `[overflow-wrap:anywhere]`/`break-all`; `scrollWidth <= 361` |
| `T2-14-03` | #14 | M1 | `LOCAL-BROWSER` | Verify `WorkReportEditor` back button at `360x740` & `390x844` using `document.elementFromPoint` | Center of back button hits the back button itself, NOT the overlapping mobile hamburger trigger |
| `T2-14-04` | #14 | M1 | `LOCAL-BROWSER` | Keyboard-only Tab / Shift+Tab / Escape walkthrough across `WorkHub` create dialog & `EvidenceLibrary` dialog | Focus trapped inside dialog, `Escape` closes dialog, focus returns to trigger button, no `maximum-scale=1` |
| `T2-14-05` | #14 | M4 | `LOCAL-BROWSER` | Automated contrast & touch-target audit across core vNext routes | Zero `<44x44px` close/icon buttons; zero `text-slate-400` informative text; `bg-teal-700` contrast `>=4.5:1` |
| `T2-15-01` | #15 | M1 | `STAGING-FULL` | Upload EICAR/infected file, polyglot/corrupt PDF (`qpdf` fail), or spoofed `Origin` header on `PUT /api/evidence/uploads/:id` | Infected/corrupt upload stays quarantined/failed (`!= ready`, non-downloadable); cross-origin `PUT` returns `403` |
| `T2-15-02` | #15 | M1 | `STAGING-MYSQL` | Call `uploadIntents.begin` past `SERS_UPLOAD_MAX_ACTIVE_INTENTS` or byte quota | Returns `429` (`UploadIntentQuotaError`); cancelling stale intent restores quota |
| `T2-15-03` | #15 | M1 | `LOCAL-HERMETIC` | Corrupt `private-browser-storage` ciphertext or switch user account scope in `localStorage` | Decryption fails closed without throwing unhandled error or leaking User A's draft to User B |
| `T2-15-04` | #15 | M1 | `LOCAL-HERMETIC` | Forged `storageKey` pointing to `work-${workId + 1}` in `outputs` table | `getPrivatePdfDownloadForUser` / `Docx` rejects with `OutputArtifactUnavailableError` (`0` storage reads) |
| `T2-15-05` | #15 | M4 | `STAGING-FULL` | Verify `compose-backup-restore` / `restore-drill` isolation & recovery checks (CI) | Restored DB + private storage match pre-backup checksums with zero cross-tenant corruption |

---

## 7. Tier 3 Matrix — Pairwise Cross-Feature Interactions (`18` Cases, `>= N = 15`)

Covers pairwise coverage across: `OwnerScope (personal | org)`, `AcademicContext (none | bound | closed_year)`, `TemplateMode (v2_fixed | switched_R12 | rolled_back)`, `Evidence (none | file_frozen | link_shared_used_in | ai_supporting)`, `Review (none | approved | rejected)`, `Output (private_pdf | private_docx | public_link | protected_qr | revoked)`, `Viewport (360px | 390px | 1440px)`.

| ID | Milestone | Env | Parameter Combination | Expected Cross-Feature Contract |
|---|---|---|---|---|
| `T3-01` | M1 | `LOCAL-BROWSER` | `personal × none × v2_fixed × file_frozen × none × private_pdf × 360px` | Personal user without year/school exports `r6` PDF with frozen image & zero school/SERS cover clutter at `360px` |
| `T3-02` | M1 | `STAGING-MYSQL` | `org × bound × legacy_PR40_fields × file_frozen × approved × protected_qr × 390px` | Legacy PR #40 `fields` identity extracts cleanly; `PublicOutput` renders institution + password gate on `390px` |
| `T3-03` | M1 | `STAGING-MYSQL` | `org × bound × v2_fixed × none × approved × revoked × 1440px` | Revoking `r1` PDF + `link` blocks `r6` PDF generation AND returns `404` on `/output/:token` + logs `audit_logs` |
| `T3-04` | M1 | `LOCAL-BROWSER` | `org × bound × v2_fixed × file_frozen × none × stale_draft_PDF × 360px` | Editing draft after `v1` blocks PDF/Share until explicit override; PDF still renders `v1` frozen snapshot |
| `T3-05` | M2 | `STAGING-MYSQL` | `personal × none->bound × v2_fixed × text × none × private_docx × 1440px` | Attaching academic year later updates draft work; `v1` keeps pre-attach `null` context while `v2` captures new year |
| `T3-06` | M2 | `STAGING-MYSQL` | `org × bound × v2_fixed × file_frozen × pending -> member_suspended × 390px` | Suspending reviewer mid-flight blocks `review.decide` (`FORBIDDEN`) and hides org works on reload |
| `T3-07` | M2 | `LOCAL-BROWSER` | `org × bound × school_autofill × custom_override × none × private_pdf × 1440px` | School auto-fill populates identity, user overrides `reportPreparer` per-draft without mutating org profile |
| `T3-08` | M2 | `STAGING-MYSQL` | `personal × bound_personal_year × v2_fixed × file_frozen × none × attempt_public_link` | Personal academic year allowed; public link still blocked with explicit policy guidance (`O008`) |
| `T3-09` | M3 | `STAGING-MYSQL` | `org × bound × switched_R12(preserve_hidden) × file_frozen × approved × private_docx × 1440px` | Switched template + frozen image exports editable DOCX (`r4`); hidden fields preserved across subsequent edits |
| `T3-10` | M3 | `STAGING-MYSQL` | `org × bound × switched_R12 -> rolled_back × link_shared_used_in × approved × public_link` | Rollback restores exact `templateVersionId`; linked `Used-in` asset unaffected |
| `T3-11` | M3 | `STAGING-MYSQL` | `org × bound × portfolio_R08 × 2_referenced_works + 1_deleted_asset × none × private_pdf` | Portfolio `v1` pins work versions; subsequent soft-delete of asset leaves portfolio `v1` PDF intact |
| `T3-12` | M3 | `STAGING-MYSQL` | `personal × none × legacy_import_J08 × text × none × private_docx × 360px` | Legacy localStorage report imported into `v2` `WorkItem`, versioned, and exported as private DOCX |
| `T3-13` | M3 | `STAGING-MYSQL` | `org × bound × restore_v1_as_head × preflight_CONV05 × approved × private_pdf` | Restoring `v1` as new head creates editable `rev`; preflight passes cleanly before `v3` export |
| `T3-14` | M4 | `STAGING-MYSQL` | `org × bound × self_eval_R09 × standard_v1_pinned × approved × public_link × 1440px` | Self-Evaluation cycle pins `standard_versions` v1; publishing v2 does not alter approved v1 output |
| `T3-15` | M4 | `STAGING-MYSQL` | `org × closed_year × operational_plan_R09 × execution_proof × none` | Closed academic year rejects new work creation, allows rollover clone into next active year as `draft` |
| `T3-16` | M4 | `STAGING-MYSQL` | `personal × none × sandbox_entitled_template × ai_supporting × none × private_pdf` | Entitled template applies to personal work; AI-assisted section marked `مسودة غير مؤكدة` until user confirms |
| `T3-17` | M4 | `STAGING-FULL` | `org × bound × v2_fixed × ai_image_classify(no_policy) × none × manual_upload_fallback` | AI image classification blocked by policy gate while ClamAV/qpdf manual upload + linking succeeds end-to-end |
| `T3-18` | M4 | `LOCAL-BROWSER` | `public_output × protected_qr × Arabic_Indic_range(١٤٤٨–١٤٤٩) × 360px × slow_network_retry` | Mobile `360px` public viewer retries network error, accepts password, renders `<bdo dir="ltr">` numerals & institution safely |

---

## 8. Tier 4 Matrix — Real-World Educator & School Workloads (`10` Scenarios, `>= max(5, ceil(N/2)) = 8`)

| ID | Milestone | Env | Scenario Title & Persona | End-to-End Multi-Step Workload & Assertions |
|---|---|---|---|---|
| `T4-01` | M1 | `STAGING-FULL` | **School Report Lifecycle (`Cairo` + Identity + Review + QR + Word)** | Teacher creates org report -> enters Arabic fields + school logo PNG + preparer/principal -> saves `v2` -> uploads PNG evidence (ClamAV+qpdf) -> creates `v1` -> peer reviewer approves -> exports private `r6` PDF & `r4` DOCX (`Noto Kufi` + `.odttf`) -> creates `protected` QR share -> public user unlocks at `390px` -> owner revokes -> `404` & `audit_logs` verified. |
| `T4-02` | M1 | `LOCAL-BROWSER` | **Compact Android (`360px`) Field Teacher Offline & CAS Conflict Recovery** | Teacher on `360x740` opens `WorkReportEditor` -> loads with simulated initial API failure -> clicks Retry -> edits fields & `reportIdentity` -> network drops (`offline`) -> reloads page -> encrypted backup restores edits -> another session bumps server revision -> teacher hits CAS conflict -> copies local edits, inspects field diff, confirms server reload without data loss. |
| `T4-03` | M2 | `STAGING-MYSQL` | **First-Time Independent Saudi Teacher (<60s Activation)** | Brand-new user (`0` schools, `0` academic years) signs in -> lands on `/work` -> creates personal report with title only -> writes report without school fields or blank principal signature -> uploads/links 1 personal PDF -> creates `v1` -> downloads private PDF & editable Word -> later adds personal academic year and binds work. |
| `T4-04` | M2 | `STAGING-MYSQL` | **School Governance, Academic Year Setup & Staff Departure (`BR02`/`O003`)** | Principal creates school -> invites Teacher & Reviewer -> both accept -> creates sequential 3-term academic year -> Teacher creates org report using `"تعبئة بيانات المدرسة"` -> Teacher leaves school (`status = "left"`) -> Teacher's access to school works & `/api/work-outputs/:id/download` immediately returns `403/404` while `creatorUserId` attribution and org access remain intact for Principal. |
| `T4-05` | M3 | `STAGING-MYSQL` | **Non-Destructive Template Migration & Rollback Under Live Edits (`R12`)** | Teacher drafts rich `workshop-report` (with `participantsCount`, `materials` list, `summary`, `reportIdentity`, `2` evidence assets) -> flushes edits -> previews switch to `initiative-report` -> preserves unmapped fields via appendix/hidden -> edits new fields & saves -> decides to rollback via `historyId` -> exact `workshop-report` fields & `templateVersionId` restored. |
| `T4-06` | M3 | `STAGING-MYSQL` | **Dynamic Teacher Portfolio Without File Duplication (`R08` + `R04`)** | Teacher has 2 approved reports + 4 evidence assets (`Used-in` across reports) -> creates `portfolio` WorkItem -> links existing reports by reference + imports 1 legacy `/portfolio` section (with PII check) -> inspects Green/Amber/Red readiness -> deletes 1 draft-only asset safely via `Used-in` impact modal -> pins `portfolio` `WorkVersion` -> exports consolidated PDF portfolio with zero duplicate storage files. |
| `T4-07` | M3 | `STAGING-MYSQL` | **Legacy Report Rescue & Version Head Restoration (`J08` + `R21`)** | Educator with 3 historical `/reports/legacy` localStorage drafts opens guided `J08` importer -> reviews diff -> imports Draft #1 into `workItems` -> creates `v1`, edits into `v2` -> realizes `v1` structure was better -> restores `v1` as new head (`rev + 1`) -> runs `CONV-05` preflight -> creates `v3` & exports. |
| `T4-08` | M4 | `STAGING-MYSQL` | **School Self-Evaluation Cycle -> Improvement Plan -> Operational Plan (`R14` + `R09`)** | School admin seeds/selects official ETEC `standard_versions` v1 -> starts `self_evaluation` cycle -> team links `execution_proof` vs `supporting_material` assets -> enters justified indicator ratings (attempt without justification rejected) -> generates `improvement_plan` initiatives from weak indicators -> links to `operational_plan` KPIs for academic year -> closes year -> rolls over operational plan draft to next year. |
| `T4-09` | M4 | `STAGING-MYSQL` | **Sandbox Store Purchase, Webhook Replay & Decoupled Template Apply (`R13` + `F15` + `F16`)** | With `SERS_COMMERCE_SANDBOX=1`, educator purchases premium report template -> sandbox webhook fires 3x concurrently (only 1 purchase + 1 entitlement created) -> educator applies template to existing draft -> first apply fails on CAS conflict -> entitlement stays intact in «قوالبي» -> educator retries apply cleanly without re-paying -> creates `WorkVersion` that remains exportable even after entitlement expiry. |
| `T4-10` | M4 | `STAGING-FULL` | **PII-Redacted AI Draft Assist + Outage Resilience + Strangler Boundary (`R06` + `R20` + `R5`)** | Educator invokes AI report helper with draft containing Saudi phone (`05...`), national ID (`10...`), and email -> accepts `<AiPrivacyGate>` -> synthetic provider receives redacted text only -> suggestion displays `مسودة غير مؤكدة (AI)` badge -> provider then enters outage/quota limit -> educator seamlessly edits manually, uploads real `execution_proof` PDF, and completes versioned PDF export. |
