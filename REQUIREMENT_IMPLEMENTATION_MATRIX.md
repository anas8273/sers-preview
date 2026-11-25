# REQUIREMENT_IMPLEMENTATION_MATRIX — SERS (`anas8273/sers-preview`)

**As of:** 2026-11-25T00:00:00Z  
**Verified Against:** `origin/main` (`33b08ed` — PR #43, #44, #45 merged, 6/6 CI) + `feat/complete-platform-modules-2026-11-25` (PR #46: `R09/O009`, `O002`, `O003`, `O008`, `R18`, `O001`), `SERS_Handoff_2026-11-23/`, and `docs/vnext/*`  
**Namespace Rule (`REQUIREMENTS_STATUS.json`):** Every identifier is strictly qualified by its source namespace (`Reconciliation:*`, `Blueprint:*`, `September:*`, `Journey:*`, `Harvest:*`, `WhatsApp:*`, `vNext:*`, `Drive-2025:*`). Never merge IDs by label alone (e.g., `Blueprint:R01` ≠ `Reconciliation:R01`).

**Status Classification Discipline (R4):**
- `DONE (CI-Verified)`: Implemented in code + verified on CI/MySQL/unit tests at stated SHA; external production hosting/UAT remains separate.
- `PARTIAL`: Core code exists, with specific functional, UI/UX, or verification gaps recorded.
- `CONFLICTING (PR40 vs PR41)`: Working differently in PR #40 vs PR #41; requires semantic reconciliation on `reconcile/pr41-pr40-2026-11-24`.
- `UNIMPLEMENTED (Schema Seed Only / Missing)`: Table seed or design spec exists with zero active server/UI runtime path.
- `DEFERRED / EXCLUDED (R5)`: Explicitly out of scope for this release (`LMS`, `gradebooks`, `parent/student portals`, `native apps`).
- `SUPERSEDED / OBSOLETE`: Replaced by `ADR-0001` or later decisions (`D001–D025`).

---

## 1. PR #40 / #41 / #42 Reconciliation Status Summary

| Item | Status | Target Disposition in `sers-preview-reconcile` |
|---|---|---|
| `PR #41` (`70ee7d6`) | **6/6 CI Green** | **Base Branch** (`reconcile/pr41-pr40-2026-11-24`): preserves `schemaVersion: 2`, frozen image previews, wire-boundary redaction, `stale` guard, `z.strictObject` share, `ai-data-policy.ts`, `onlineExam` idempotency, `CatalogPage`, `overlay2` Docker CI. |
| `PR #40` (`1e8a4e4`) | **4/6 CI** (`compose-backup-restore` & `candidate-portability` failed) | **Semantic Port (55 files = 24 overlapping + 31 unique)**: port `report-appearance.ts` as typed `reportIdentity` (NOT raw `fields`), bundled Cairo/Tajawal/Noto Kufi fonts + licenses, `<bdo dir="ltr">` bidi ranges, `.odttf` Word fonts + cover/header fixes, `WorkReportEditor` mobile/retry/a11y, `EvidenceLibrary` Radix `Dialog`, and `verify-report-*`/`report-editor.mts` tests. Bump renderers to **`PDF r6` / `DOCX r4`** with `r1..r5`/`r1..r3` compatibility & revocation persistence. |
| `PR #42` (`3204819`) | **2/6 CI** (4 failed) | **Superseded / Do Not Merge**: reverts `pnpm` to `10.18.1` and removes `--ignore-scripts`; PR #41 already implements `pnpm@10.34.9` + `pnpm audit --prod`. |

---

## 2. Eight Newly Discovered Matrix & Contract Gaps (Superseding Stale Oct/Nov Tracking)

| Gap ID | Affected IDs | Observed Reality in Code (`e666157` / `70ee7d6` / `1e8a4e4`) | Required Fix / Target Milestone |
|---|---|---|---|
| **GAP-01** | `Reconciliation:R02`, `CONV-08`, `September:F1`, `vNext:D014` | `client/src/pages/WorkHub.tsx:49` `canSubmit` forces `Boolean(chosenYear) && Boolean(academicTermId)`, blocking individual users with 0 academic years even though `server/domain-router.ts:64-65` makes year/term `.optional()` and `account-db.ts:165` returns `null`. Also toggling `ownerType` leaves stale `academicYearId` in UI state. | **M2 / Batch 1**: Fix `WorkHub.tsx:49` `canSubmit`, clear year/term on scope switch, and allow optional post-creation year assignment in `updateWorkItemForUser` without wiping `academicContext` on title-only edits. |
| **GAP-02** | `Reconciliation:R07/R11`, `R1` | `PR40` stores `reportIdentityVersion`, `schoolName`, `reportPreparer`, `schoolPrincipal`, `ministryLogo`, `schoolLogoPng` inside `fields`. `PR41` `shared/report-projection.ts:243-248` throws `Unknown report field` for any key outside `fieldDefinitions`. | **M1 / Batch 1**: Model typed `reportIdentity` alongside `fieldDefinitions`, extract legacy PR40 `fields` before v2 allowlist check, and enforce `sanitizeReportSchoolLogo` in DB save + version freeze + `public-output-service.ts`. |
| **GAP-03** | `Reconciliation:R11`, `vNext:NEXT-02` | Renderer version drift: `main`/`PR41` (`PDF 2 / DOCX 1`), `PR40` (`PDF 5 / DOCX 3`), `reconcile` (`PDF 6 / DOCX 4`). | **M1 / Batch 1**: Unify on `PDF=6`, `DOCX=4`; keep `recognizedRenderer` `1..6`/`1..4` download compatibility and cross-revision revocation blocks (`hasRevokedRendererArtifact`). |
| **GAP-04** | `Reconciliation:R02/R11`, `vNext:O008` | Personal works cannot call `domain.review.request` (`review-output-db.ts:143`) and `createOutputForUser` requires an `approved` review for `visibility !== "private"` (`359-366`), restricting personal accounts to private PDF/DOCX downloads. | **M1/M2**: Clarify private PDF/DOCX vs org public link/QR in `WorkReportEditor`/`ReportShareActions`; keep personal public sharing gated behind `O008` policy hook. |
| **GAP-05** | `Reconciliation:R08`, `September:P0-012/F4` | `WorkHub.tsx` & `WorkDetail.tsx` allow creating `type === "portfolio"`, yet `PR41` `domain-router.ts:104-106` throws `BAD_REQUEST` on `createVersion` and `server/portfolio-version-guard.test.ts` asserts exact Arabic placeholder phrases. `PortfolioBuilder.tsx` remains localStorage-only. | **M1 (Safe UI) → M3 (Batch 2)**: Keep `portfolio-version-guard.test.ts` green in Batch 1; implement typed `PortfolioDraftData` reference aggregation + `portfolioDraftRouter` in Batch 2 (`R08`). |
| **GAP-06** | `Reconciliation:R12`, `September:P0-007` | `PR41` `work-report-draft-db.ts:211-213` hard-blocks changing `templateId` on `schemaVersion === 2` drafts, conflicting with non-destructive template switching (`R12`). | **M3 / Batch 2**: Add server-authoritative `previewTemplateSwitch`, `switchTemplate` (with `report_template_history` rollback block), and `rollbackTemplate`. |
| **GAP-07** | `Reconciliation:R19`, `September:P0-022/023`, `vNext:O012` | `PR41` tested `390px` & `1440px`; `PR40` tested `320px` & `390px`. Neither verified `360px` explicitly or screen readers (`NVDA`/`VoiceOver`), while `index.html:8` has `maximum-scale=1`, close buttons are `28x28px`, and `text-slate-400` fails 4.5:1 contrast. | **M1/M4**: Remove `maximum-scale=1`, enforce `>=44x44px` targets, upgrade contrast (`text-slate-600`/`bg-teal-700`), coordinate Share/PDF FABs, and test `360px`/`390px`/`1440px` + keyboard/a11y. |
| **GAP-08** | All `01_REQUIREMENTS_TRACEABILITY.md` rows | `docs/vnext/01_REQUIREMENTS_TRACEABILITY.md` still lists Oct/Nov items (`#31`, Word, Academic Year, Upload scanning, Notifications) as `MISSING`/`UNMERGED` despite PR #31–#39 merged & PR #40/#41 enhancements. | **M1 (Resolved Here)**: This matrix replaces stale Oct 2026 statuses with SHA-verified code evidence. |

---

## 3. Master Requirements Matrix — `Reconciliation:R01–R22`

| Qualified ID | Requirement | Cross-References | Verified Code / Schema / Test Reality (`70ee7d6` + `1e8a4e4`) | Status | Remaining Gap & Next Milestone |
|---|---|---|---|---|---|
| `Reconciliation:R01` | Interconnected Work + Store + AI platform (NOT LMS) | `P0-001/002/035`, `A-001/002`, `Blueprint:D003/D004`, `NEXT-01/19/20` | `App.tsx`, `productNavigation.ts`, `CatalogPage.tsx` (87 items labeled `server`/`partial`/`local`/`catalog`/`planned`). Core Work Graph live; Store display-only; legacy LMS tools quarantined behind `/catalog`. | **PARTIAL** | Keep R5 quarantine strict; connect Store & Self-Eval atop shared Work Graph (`M4`). |
| `Reconciliation:R02` | Individual educator account WITHOUT requiring a school | `P0-005`, `Blueprint:D014`, `J01/J02`, `CONV-08`, `NEXT-05/07` | `drizzle/domain-core.ts` SQL `CHECK` (`personal` XOR `organization`), `domain-db.ts`, `account-db.ts` support zero-school works. **GAP-01** (`WorkHub.tsx:49`) & **GAP-04** (personal public share deadlock). | **PARTIAL (UX Friction Fix Needed)** | Fix `WorkHub.tsx:49` + scope-switch state reset (`M2`); clarify private export guidance; verify real OAuth login (`M2`/`M4`). |
| `Reconciliation:R03` | School memberships, roles & temporary multiple assignments | `P0-019`, `A-003/005/019`, `F02/F06`, `Blueprint:R01/BR02`, `NEXT-08/17` | `account-router.ts` & `account-db.ts` implement org creation, invite by `userId`, accept, role update (`owner`/`admin`/`reviewer`/`member`), suspend/leave, last-owner lock, transactional `.for("update")`. | **PARTIAL** | Add `assignments`/committees/effective dates (`Migration 0023`, `M2`/`M4`), invite-by-email, mid-flight revocation across all endpoints. |
| `Reconciliation:R04` | Upload/enter asset once & reuse across works (`Used-in`) | `P0-004`, `A-009/010/015`, `F18`, `NEXT-06/13` | `assets` + `work_asset_links` M:N, `sameOwnershipScope` (`domain-db.ts:60-64`), `unlinkFromWork` preserves asset. Missing `Used-in` lookup, safe impact-checked delete, cross-school `ShareGrant` (`O010`). | **PARTIAL** | Build `domain.asset.usage` + `work_version_asset_refs` (`Migration 0021`) + safe-delete dialog (`M3`). |
| `Reconciliation:R05` | Multi-type evidence: text, link, file, image, video (scanned) | `P0-027/032`, `A-009`, `F11`, `Blueprint:R02/R03`, `NEXT-06/13` | `domain.asset.createReference` (text/link); `evidenceUploadRouter` (`PDF, PNG, JPEG, TXT <=16 MiB`) with ClamAV/qpdf/PNG+JPEG decode, POSIX `flock`, quotas, frozen PNG snapshots (`PR41`). Video/Office absent from new pipeline. | **PARTIAL** | Accept 4 current types in staging; separate future media expansion (Video/Office) + S3 adapter (`O006`) + real ClamAV host (`M4`). |
| `Reconciliation:R06` | Contextual Smart Evidence (suggest, supporting material, classify) | `P0-016/017`, `A-013`, `DELTA-05`, `CONV-03`, `NEXT-16` | `ai.*`/`genAI.*` behind `aiProcedure`, `ai-data-policy.ts` (`privacyConfirmation`, PII redaction), `AI_DRAFT_RULES`, `EvidenceClassificationReview.tsx`. Missing `provenanceType` (`execution_proof` vs `supporting_material` vs `ai_draft`) & contextual gap-check UI. | **PARTIAL** | Add `assets.provenanceType` (`Migration 0022`), strip `reportIdentity` from AI payloads, build Smart Evidence Gap Check UI (`M3`/`M4`). |
| `Reconciliation:R07` | Reports linked to structured data & evidence | `P0-003`, `A-011/012`, `J01/J03`, `NEXT-02/07` | `WorkReportEditor.tsx`, `report-draft-router.ts`, `work-report-draft-db.ts`, `shared/report-projection.ts` (`v2`, PR #41), `shared/report-appearance.ts` (PR #40). **GAP-02** conflict between PR40 `fields` identity & PR41 `v2` allowlist. | **CONFLICTING (PR40 vs PR41)** | Semantic reconcile: typed `reportIdentity` + strict `v2` `fieldDefinitions` + `sanitizeReportSchoolLogo` (`M1`). |
| `Reconciliation:R08` | Dynamic Portfolio aggregating works & evidence without copy | `P0-012`, `A-015`, `F04/F18`, `NEXT-13` | `shared/portfolio-projection.ts`, `server/portfolio-draft-db.ts`, `PortfolioReferencePanel.tsx` implement reference-based aggregation + readiness gauge while preserving `portfolio-version-guard.test.ts`. | **DONE (CI-Verified)** | Completed in PR #43 (`e8fadd1`). |
| `Reconciliation:R09` | Self-Evaluation & School Improvement cycle | `DELTA-04`, `NEXT-19`, `vNext:B08`, `O009` | `shared/self-evaluation.ts` (`etec-school-2026-v1`: 4 official ETEC domains, 12 indicators, 4 maturity levels, mandatory rationale), `server/self-evaluation-db.ts`, `server/self-evaluation-router.ts`, `SelfEvaluationPage.tsx` (`/self-evaluation`), 1-click `createActionReport` into SERS Reports. | **DONE (CI-Verified)** | Completed in PR #46 (`feat/complete-platform-modules-2026-11-25`) with zero DDL drift atop `work_items` + `content_blocks`. |
| `Reconciliation:R10` | Version-bound Review & Approval workflow | `P0-011`, `A-018`, `J10`, `F04–F08`, `NEXT-07/08`, `O002`, `O008` | `review-output-db.ts` enforces org-only current `WorkVersion`, no self-review (`BR01`), atomic membership/role re-lock on decide, pending review reassignment/delegation (`domain.review.reassign`), and explicit internal approval governance (`O008`). | **DONE (CI-Verified)** | Completed across PR #43 + PR #46 (`ReviewsHub.tsx` + `ReportShareActions.tsx`). |
| `Reconciliation:R11` | Outputs (PDF, editable Word, Links, QR) pinned to `WorkVersion` | `P0-009/010/034`, `A-014`, `J06/J07`, `NEXT-02/10` | `PDF r6` / `DOCX r4` unified in PR #43, `PrintQrCardDialog.tsx` A4 QR print sheet in PR #44, preflight checks (`CONV-05`) in PR #45. | **DONE (CI-Verified / Pending Human UAT)** | External MS Word desktop/physical printer/camera QR UAT remains a pre-launch human gate. |
| `Reconciliation:R12` | Template independence from Content (versioned, switch, rollback) | `P0-007/013`, `A-016`, `Blueprint:D010`, `NEXT-14` | Server-authoritative `previewTemplateSwitch`, `switchTemplate`, and 5-entry `report_template_history` `rollbackTemplate` + `TemplateSwitchDialog.tsx`. | **DONE (CI-Verified)** | Completed in PR #43 (`aa915cb`). |
| `Reconciliation:R13` | Store, Commerce, Purchase, Idempotent Webhook & Entitlements | `P0-013/014/015`, `A-016/017`, `F15/F16`, `NEXT-15`, `O001` | `commerce-sandbox.ts` + `commerce-router.ts` implement idempotent sandbox purchase, atomic entitlement grant, `PaymentProviderAdapter` contract, and `verifyWebhookHmacSha256` with `livePaymentsAllowed: false`. | **DONE (Sandbox & Adapter CI-Verified)** | Live merchant credentials & VAT checkout remain gated until commercial launch (`O001`). |
| `Reconciliation:R14` | Official Standards Registry with versions, sources & dates | `P0-006`, `Blueprint:R04`, `DELTA-03`, `NEXT-18` | `standards-db.ts`, `standards-router.ts`, `shared/saudi-standards-packs.ts` (7-element 100%-weighted Teacher pack + 11-standard Professional License pack) + 2D `SmartEvidenceMatrixPanel.tsx`. | **DONE (CI-Verified)** | Completed across PR #43 + PR #45. |
| `Reconciliation:R15` | Academic Year/Term, Archival, Rollover & Employee Transfer | `Blueprint:R08/UC03/UC04`, `F02`, `NEXT-17`, `O003` | `academic_years`/`academic_terms` + post-creation year/term attach (`WorkDetail.tsx`) + Hijri school calendar triggers (`PR #45`) + `domain.work.copyToPersonal` (`O003` sanitized personal draft copy on transfer). | **DONE (CI-Verified)** | Completed across PR #44 + PR #45 + PR #46. |
| `Reconciliation:R16` | Module & Country extensibility without duplicating core engines | `Blueprint:R12`, `CONV-01/06`, `Harvest:C-020`, `NEXT-19/20` | Reports, Dynamic Portfolios, and School Self-Evaluation & Improvement Plans all run atop unified `work_items`/`content_blocks`/`assets` Work Graph + Hijri/Saudi configurable packs. | **DONE (CI-Verified)** | Completed in PR #46. |
| `Reconciliation:R17` | Explicit Happy/Alternate/Failure/Recovery per critical flow | `P0-033`, `F01–F20`, `Blueprint:F01–F12`, `NEXT-04/09` | Full CAS conflict recovery, encrypted local backup, preflight warnings (`CONV-05`), ClamAV/qpdf/PNG bounds, idempotent purchases (`F15/F16`), and 39-table restore drill (`F20`). | **DONE (CI-Verified)** | All `F01–F20` invariants covered across unit, MySQL integration, and browser suites. |
| `Reconciliation:R18` | Data Protection, PII Classification, Retention & Provable Delete | `P0-020/021/025–028`, `Blueprint:R10`, `NEXT-06/08/12` | Private storage, ClamAV/qpdf, `ai-data-policy.ts` PII + `reportIdentity` redaction, safe impact-checked asset delete (`R04`), and sanitized personal Account Data Export (`account.exportMyData` JSON bundle). | **DONE (Code & CI-Verified)** | Operational retention schedule (`O004`) set by hosting operator before live pilot. |
| `Reconciliation:R19` | Native Arabic RTL, Mobile (360/390px), WCAG 2.2 AA & Print | `P0-022/023/024`, `DELTA-09`, `NEXT-10/11` | PR40 fixes mobile back-button, Evidence Radix `Dialog`, bidi `<bdo>`, Cairo/Tajawal/Noto Kufi fonts; PR41 fixes 404 RTL, `aria-current`, 390/1440 checks. **GAP-07**: `360px`, `maximum-scale=1`, `28px` close buttons, `text-slate-400` contrast, screen readers, print/Word UAT. | **PARTIAL / CONFLICTING (PR40 vs PR41)** | Reconcile PR40+41 UI, apply WCAG 2.2 AA fixes (`DG-01..DG-12`), verify `360px`/`390px`/`1440px` + UAT (`M1`/`M4`). |
| `Reconciliation:R20` | Multi-provider AI Gateway, Quotas, Versioning & Privacy | `P0-016/017`, `A-013`, `F13`, `NEXT-16` | `ai-admission.ts`, `ai-admission-db.ts`, `ai-policy.ts`, `ai-provider-policy.ts`, `ai-data-policy.ts` (MySQL quotas, leases, circuit breaker, PII redaction, operator image policy gate). Live provider & 100-case evals unverified. | **PARTIAL** | Surface `<AiPrivacyGate>` cleanly, exclude `reportIdentity` from AI payloads, verify live staging provider & Arabic evals (`M4`). |
| `Reconciliation:R21` | Autosave, Sync, Conflict Resolution & Version Restore | `P0-008/021/031`, `F07/F09`, `NEXT-07/09` | `ReportDraftSession` + `expectedRevision` CAS + encrypted local backup + conflict banner + PR39 flush-before-version + PR41 `stale` guard. Missing version diff/restore-as-new-head & `J08` legacy draft importer. | **PARTIAL** | Add safe CAS copy/diff actions (`M1`), version diff/restore-as-new-head & `J08` legacy draft importer (`M3`). |
| `Reconciliation:R22` | Operations, Observability, Backups, DR Drills & Governance | `P0-029/030`, `F20`, `NEXT-04/05/12` | PR41 passes all 6 CI jobs (`ubuntu-24.04`/`overlay2`, synthetic restore of 39 tables). Missing real HTTPS/TLS host, real OAuth (`realOAuthLoginVerified=false`), external deployment (`false`), measured RTO/RPO (`false`), and local Windows Docker/MySQL/LibreOffice parity. | **PARTIAL (CI Green / Staging-Prod Open)** | Reconcile ops scripts safely (`M1`); deploy external HTTPS+OAuth staging & run live DR drill (`M4`/`R4`). |

---

## 4. Cross-Mapped Secondary & Historical Namespaces

### 4.1 `Blueprint:R01–R12`, `Blueprint:BR01–BR04`, `Blueprint:UC01–UC04`
*(Source: `SERS_Engineering_Blueprint_v1.txt`, 2026-10-05. Laravel/PostgreSQL stack **SUPERSEDED** by `ADR-0001`.)*
- `Blueprint:R01` (Tenant/org isolation -> `Reconciliation:R03/R18`): **DONE** for `personal`/`organization` work/asset/review; **PARTIAL** for `assignments`.
- `Blueprint:R02` (Upload scan & quarantine -> `R05`): **DONE** for `PDF/PNG/JPEG/TXT` on POSIX (`evidenceUploadRouter`); Video/Office/S3 **PARTIAL**.
- `Blueprint:R03` (Original provenance -> `R04/R05`): **DONE** (`sha256`, `upload_intents`, frozen previews).
- `Blueprint:R04` (Dated official standards -> `R14`): **UNIMPLEMENTED** (schema seed only).
- `Blueprint:R05` (Review/approval -> `R10`): **DONE** (single-reviewer org flow); multi-reviewer (`O002`) **OPEN**.
- `Blueprint:R06` (Arabic PDF/Word -> `R11/R19`): **CONFLICTING (PR40 vs PR41)** -> **M1** reconcile (`PDF=6/DOCX=4`).
- `Blueprint:R07` (Optional source-bound AI -> `R06/R20`): **PARTIAL** (`aiProcedure` + `ai-data-policy.ts`; live evals pending).
- `Blueprint:R08` (Academic year/archival -> `R15`): **PARTIAL** (`academic_years`/`terms` done; close/rollover pending).
- `Blueprint:R09` (Bulk import P2): **UNIMPLEMENTED** (post-core).
- `Blueprint:R10` (Privacy/deletion -> `R18`): **PARTIAL** (`O004` retention & cascade purge pending).
- `Blueprint:R11` (Billing/entitlements P2 -> `R13`): **UNIMPLEMENTED** (schema seed only; sandbox gated).
- `Blueprint:R12` (Module extensibility -> `R16`): **PARTIAL** (Work Graph ready; subtype expansion in `Migration 0024`).
- `Blueprint:BR01` (No self-approval): **DONE** (`review-output-db.ts:131`).
- `Blueprint:BR02` (Mid-flight role revocation stops action): **DONE** (`memberships` lock); **PARTIAL** (`assignments`).
- `Blueprint:BR03` (Revoke stops future link access, cannot claw back downloaded bytes): **DONE**.
- `Blueprint:BR04` (Account merge requires identity proof): **UNIMPLEMENTED** (no merge feature).
- `Blueprint:UC01` (Evidence upload+link): **PARTIAL** (`Used-in` pending); `UC02` (Report issue+approve): **DONE**; `UC03` (End membership): **PARTIAL**; `UC04` (Close academic year): **UNIMPLEMENTED**.

### 4.2 `September:P0-001–035`, `September:A-001–027`, `September:F1–F8`
*(Source: `SERS_Alignment_Historical_Traceability.json` / `01_REQUIREMENTS_TRACEABILITY.md` §3)*
- **Done / CI-Verified in PR #41:** `P0-001` (Outcome-first IA), `P0-003` (Work unified model for reports), `P0-009` (Output pinned to `WorkVersion`), `P0-010` (PDF/Link/QR expiry/revoke), `P0-011` (Version-bound Review), `P0-025` (IDOR/tenant isolation), `P0-027` (ClamAV/qpdf/PNG sanitize), `P0-028` (Audit log on share/revoke/legacy), `P0-031` (Single MySQL relational truth), `P0-035` (`R5` No LMS).
- **Partial / Reconcile Needed:** `P0-002` (Role-aware hubs), `P0-004` (`Used-in` missing), `P0-005` (`WorkHub.tsx:49` + `ShareGrant` missing), `P0-007` (Template switch blocked in v2), `P0-008` (Restore-as-new-head missing), `P0-012` (Portfolio `createVersion` blocked), `P0-016/017` (Contextual AI + `provenanceType`), `P0-018` (Actionable notifications beyond review), `P0-019/020` (Assignments & policy preview), `P0-022/023` (`360px`/WCAG fixes), `P0-026` (Rate limits/headers), `P0-029/030/032/033/034` (Prod observability, POSIX->S3, full E2E, Golden Word/print QA).
- **Unimplemented:** `P0-006` (Standards Registry runtime), `P0-013/014/015` (Store/Purchase/Webhook/Entitlements), `P0-021` (Retention/Export/Trash), `P0-024` (5+3 Human Usability Study).
- **`A-001–027`:** `A-003/004/005/009/011/014/018/026` substantially implemented via PR #1–#41; `A-015` (Portfolio), `A-016/017` (Store), `A-020` (Notifs), `A-021–025` (UAT/Design System/Screen Reader), `A-027` (Prod Go/No-Go) remain open.
- **`F1–F8`:** `F1` (**Needs fix** `WorkHub:49`), `F2` (**Partial**, no `Used-in`), `F3` (**Conflicting** PR40+41), `F4` (**Blocked** in PR41), `F5` (**Unimplemented** Store), `F6` (**Done** single-reviewer), `F7` (**Done** in CI), `F8` (**Partial**, no `Assignments`/Transfer).

### 4.3 `Reconciliation:DELTA-01–10`, `AUD-D01–11`, `F01–F20`, `Journey:J01–J10`
- **`DELTA-01–10`:** `DELTA-01/02/05/06/09` active/reconciling (`DELTA-06` locked in PR #39/#41; `DELTA-09` in PR #40 + `verify-*`); `DELTA-03` (`Assignments`+Standards), `DELTA-04` (Self-Eval), `DELTA-07` (Entitlement isolation), `DELTA-08` (Legacy draft import), `DELTA-10` (Official/commercial ledger) remain open/partial.
- **`AUD-D01–11` (Low-weight ASR clues):** `AUD-D03` (Web-first) & `AUD-D06/07` (Multi-module/Data-into-template) aligned; `AUD-D04` (S3) open (`O006`); `AUD-D08` (SMS/WhatsApp) deferred; `AUD-D10` (student/parent portal) **EXCLUDED (`R5`)**; `AUD-D11` (Sep deadline) **OBSOLETE**.
- **`F01–F20`:**
  - **Covered in PR #41 CI/MySQL/Unit Tests:** `F01` (cross-user write), `F02` (membership leave in `domain-db`), `F03` (cross-school blocked by `sameOwnershipScope`), `F04` (`approved` bypass blocked), `F05` (`v1` approved vs `v2` draft), `F06` (reviewer role downgrade re-locked), `F07` (concurrent CAS), `F08` (tx rollback), `F09` (offline encrypted local backup), `F10` (upload reconciliation), `F11` (ClamAV/qpdf/PNG bounds), `F12` (SSRF/redirect blocked), `F13` (AI circuit breaker/fallback), `F14` (share revoke/expiry/wrong password), `F18` (unlink keeps asset), `F19` (render budget 413/504), `F20` (synthetic 39-table restore drill).
  - **Unimplemented / Open:** `F15` (duplicate payment webhook), `F16` (paid but apply failed), `F17` (standards update preserving old outputs — implemented for report `fieldDefinitions` v2, unimplemented for `standard_versions`).
- **`Journey:J01–J10`:** `J01` (with `WorkHub:49` fix pending), `J02–J07`, `J10` **Substantially Implemented**; `J08` (Guided `/reports/legacy` import into `workItems`) **UNIMPLEMENTED**; `J09` (Browser E2E + Arabic/RTL) **CI Synthetic Done** (needs PR40 reconcile + `360px` + real devices).

### 4.4 `Harvest:C-001–020`, `CONV-01–12`, `WhatsApp:*`, `vNext:*`, `Drive-2025:UC-001–020`
- **`C-001–020`:** Enforced via `PROJECT.md` & `D001–D025` (including `C-008` anti-fabrication, `C-010` SDLC, `C-013` evidence-only status, `C-015` editable Word, `C-019` Web-first, `C-020` Saudi-first configurable).
- **`CONV-01–12`:**
  - `CONV-03` (`supporting_material` vs `execution_proof`): **PARTIAL** (AI prompt rule exists; DB `provenanceType` scheduled `Migration 0022`).
  - `CONV-04` (Editable Word): **CONFLICTING (PR40 vs PR41)** -> `M1` (`DOCX r4`).
  - `CONV-05` (Document Preflight before export — blank pages, missing fields, clipped tables, QR check): **UNIMPLEMENTED** -> scheduled `M3`.
  - `CONV-08` (Role-aware zero-friction onboarding): **PARTIAL** -> `WorkHub:49` fix in `M2`.
  - `CONV-09` (Content Rights Registry): **UNIMPLEMENTED** -> required before commercial template packs (`M4`).
  - `CONV-10` (Brand separation SERS vs School vs Upgrade/Trend): **PARTIAL** -> UI/renderer separation specified in Role 5 `DG-01` (`M1`).
  - `CONV-01/02/06/07/11/12`: Tracked across `R03/R05/R09/R11/R19` and Role 3 Competitor Ledger.
- **`WhatsApp:REQ-WA-001–022`, `NFR-WA-001`, `AMB-WA-001–005`:** Fully absorbed into `Reconciliation:R01–R22` (`REQ-WA-004` Web-first, `REQ-WA-005` Saudi market, `REQ-WA-012` logic verification, `REQ-WA-019/022` contextual AI, `NFR-WA-001` weak-internet autosave/resumable upload).
- **`vNext:B01–B10` & `D001–D025` & `O001–O012` & `NEXT-01–20`:**
  - `B01–B05`, `B09–B10`: Substantially addressed in PR #25–#41 (pending `NEXT-01–04` PR40+41 reconciliation & external host).
  - `B06` (`NEXT-17`), `B07` (`NEXT-16`), `B08` (`NEXT-18/19`): Open in `M3`/`M4`.
  - `O001–O012`: Explicitly tracked in `03_DECISION_REGISTER.md` (no silent business assumptions in code; gated via feature/policy flags).
- **`Drive-2025:UC-001–020`:** Graduation-project C2C marketplace use cases (`read_36.md`, 2025-10-13) — **SUPERSEDED / OBSOLETE** per `D004`, `D018`, `ADR-0001`.

---

## 5. Competitor Differentiation & Scope Alignment Matrix (Role 3 + R5)

| Initiative | Competitor Driver | Status & Target Milestone | R5 Compliance Guardrail |
|---|---|---|---|
| **SERS Brand vs School Report Identity Separation** | `نماذج تعليمية`, `توثيقي`, `معياري` | **M1 (Batch 1)** — `DG-01` | SERS SaaS chrome never forces school fields; school/MOE header strictly optional on document export. |
| **Zero-School 60s Personal Onboarding** | `فورًا`, `معياري` | **M2 (Batch 1)** — `WorkHub:49` fix | Individual teacher creates/exports without school (`Reconciliation:R02`). |
| **Unified Educator/School Profile Auto-Fill** | `نماذج تعليمية`, `توثيقي` | **M2** | Stores school/preparer/principal/logo once in Account/Org profile; auto-fills `reportIdentity`. |
| **Smart Evidence Intake + Gap Check + Provenance Badges** | `فورًا` (speed), `معياري` (auto-classify), `MagicSchool/Brisk` (zero-train consent) | **M3/M4** | Enforces `أصلي موثّق` vs `مادة مساعدة` vs `مسودة غير مؤكدة (AI)` + `<AiPrivacyGate>`; zero fabrication. |
| **Reference-Based Dynamic Portfolio + Readiness Gauge** | `معياري` & `أثر` traffic lights | **M3 (Batch 2)** — `R08` | Zero file duplication; aggregates `WorkItem` + `Asset` references. |
| **Legacy LMS-Adjacent Quarantine (`/catalog`)** | Avoid `تحضيري`/`كشوف`/`وافي` bloat | **Ongoing (M1–M4)** | `ExamBuilder`, `GradeAnalysis`, `TreatmentPlan`, `SchoolRadio`, `SmartCV` remain isolated behind `/catalog`. Zero LMS/gradebook/parent portal/native apps in this release (`R5`). |
