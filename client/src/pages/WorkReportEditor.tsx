import { privateLocalStorage as localStorage } from "@/lib/private-browser-storage";
import { ReportDraftSession, type ReportDraftContent } from "@/lib/report-draft-session";
import {
  REPORT_FONT_FAMILIES,
  REPORT_IDENTITY_FIELDS,
  REPORT_IDENTITY_TEXT_LIMIT,
  REPORT_IDENTITY_VERSION,
  REPORT_MINISTRY_LOGO_ALT,
  REPORT_SCHOOL_LOGO_ALT,
  REPORT_SCHOOL_LOGO_MAX_BASE64,
  REPORT_SCHOOL_LOGO_MAX_DIMENSION,
  normalizeReportIdentity,
  reportFontFamily,
  reportInstitution,
  type ReportIdentity,
} from "@shared/report-appearance";
import {
  REPORT_TEMPLATE_DEFINITIONS,
  REPORT_TEMPLATE_OPTIONS,
  REPORT_THEME_OPTIONS,
  projectReportDocument,
  type ReportFieldDefinition,
  type ReportFieldValue,
} from "@shared/report-projection";
import ministryLogoUrl from "@shared/report-assets/ministry-logo.png";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Info,
  Loader2,
  PencilLine,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import LegacyReportImportDialog from "@/components/LegacyReportImportDialog";
import TemplateSwitchDialog from "@/components/TemplateSwitchDialog";
import { trpc } from "@/lib/trpc";
import { useUserStore } from "@/stores/userStore";
import { buildReportIdentityDefaults, normalizeEducatorGender, normalizeEducatorRoleKey } from "@shared/arabic-grammar";
import "./work-report-fonts.css";

const templateOptions = REPORT_TEMPLATE_OPTIONS;
const themeOptions = REPORT_THEME_OPTIONS;
const evidenceKindLabels = { file: "ملف", link: "رابط", text: "نص" } as const;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "offline" | "conflict" | "error";
type MobileView = "edit" | "preview";

type LocalBackup = ReportDraftContent & { baseRevision: number; updatedAt: string };
const emptyDraft: ReportDraftContent = { templateId: "custom", themeId: "classic", fontFamily: "Cairo", fields: {}, evidenceAssetIds: [] };

const BIDI_RANGE_PATTERN = /([0-9٠-٩۰-۹]+(?:[-–—/][0-9٠-٩۰-۹]+)+)/g;

function renderBidiText(text: string): ReactNode {
  const parts = text.split(BIDI_RANGE_PATTERN);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (
    index % 2 === 1 ? <bdo dir="ltr" key={index}>{part}</bdo> : part
  ));
}

function safeNormalizeIdentity(value: unknown): ReportIdentity | undefined {
  try {
    return normalizeReportIdentity(value);
  } catch {
    return undefined;
  }
}

function contentOf({
  schemaVersion,
  templateId,
  templateVersionId,
  themeId,
  fontFamily,
  fields,
  evidenceAssetIds,
  fieldDefinitions,
  reportIdentity,
}: ReportDraftContent): ReportDraftContent {
  return {
    schemaVersion,
    templateId,
    templateVersionId,
    themeId,
    fontFamily,
    fields,
    evidenceAssetIds,
    fieldDefinitions,
    reportIdentity: safeNormalizeIdentity(reportIdentity),
  };
}

function editorFields(content: Pick<ReportDraftContent, "templateId" | "schemaVersion" | "fieldDefinitions">): readonly ReportFieldDefinition[] {
  if (content.schemaVersion === 2 && content.fieldDefinitions?.length) return content.fieldDefinitions;
  return REPORT_TEMPLATE_DEFINITIONS[content.templateId]?.fields ?? REPORT_TEMPLATE_DEFINITIONS.custom.fields;
}

function editorFieldValues(content: Pick<ReportDraftContent, "templateId" | "schemaVersion" | "fieldDefinitions">, values: Record<string, unknown>) {
  const definitions = new Map(editorFields(content).map(field => [field.key, field]));
  return Object.fromEntries(Object.entries(values).flatMap(([key, value]) => {
    const definition = definitions.get(key);
    if (!definition) return [];
    if (Array.isArray(value)) return [[key, value.join("\n")]];
    return [[key, typeof value === "number" ? String(value) : typeof value === "string" ? value : ""]];
  })) as Record<string, string>;
}

function serverFieldValues(content: Pick<ReportDraftContent, "templateId" | "schemaVersion" | "fieldDefinitions">, values: Record<string, string>): Record<string, ReportFieldValue> {
  const definitions = new Map(editorFields(content).map(field => [field.key, field]));
  const output: Record<string, ReportFieldValue> = {};
  for (const [key, value] of Object.entries(values)) {
    const definition = definitions.get(key);
    if (!definition || !value.trim()) continue;
    if (definition.type === "list") { output[key] = value.split(/\r?\n/).map(item => item.trim()).filter(Boolean); continue; }
    if (definition.type === "number") {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed)) output[key] = parsed;
      continue;
    }
    output[key] = value;
  }
  return output;
}

function sameContent(a: ReportDraftContent, b: ReportDraftContent) {
  return a.templateId === b.templateId && a.themeId === b.themeId && a.fontFamily === b.fontFamily
    && a.schemaVersion === b.schemaVersion && a.templateVersionId === b.templateVersionId
    && JSON.stringify(a.fieldDefinitions ?? []) === JSON.stringify(b.fieldDefinitions ?? [])
    && JSON.stringify(safeNormalizeIdentity(a.reportIdentity) ?? null) === JSON.stringify(safeNormalizeIdentity(b.reportIdentity) ?? null)
    && Object.keys(a.fields).length === Object.keys(b.fields).length
    && Object.entries(a.fields).every(([key, value]) => b.fields[key] === value)
    && a.evidenceAssetIds.length === b.evidenceAssetIds.length
    && a.evidenceAssetIds.every((id, index) => id === b.evidenceAssetIds[index]);
}

function backupKey(workId: number) {
  return `sers:report-draft:${workId}`;
}

async function prepareSchoolLogo(file: File) {
  if (file.type !== "image/png" || file.size > 2 * 1024 * 1024) throw new Error("Choose a PNG up to 2 MiB");
  const header = new DataView(await file.slice(0, 24).arrayBuffer());
  if (header.byteLength !== 24 || header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a || header.getUint32(12) !== 0x49484452
    || header.getUint32(16) > 4096 || header.getUint32(20) > 4096) throw new Error("Unsupported PNG");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable");
    for (const max of [REPORT_SCHOOL_LOGO_MAX_DIMENSION, 224, 160]) {
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/png").slice("data:image/png;base64,".length);
      if (base64 && base64.length <= REPORT_SCHOOL_LOGO_MAX_BASE64) return base64;
    }
    throw new Error("School logo exceeds the report limit");
  } finally { image.close(); }
}

function parseBackup(workId: number): LocalBackup | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(backupKey(workId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<LocalBackup>;
    if (!Number.isInteger(parsed.baseRevision) || typeof parsed.updatedAt !== "string") return undefined;
    if (!parsed.fields || typeof parsed.fields !== "object") return undefined;
    const rawFields = parsed.fields as Record<string, unknown>;
    const legacyIdentity = parsed.reportIdentity === undefined && rawFields.reportIdentityVersion === REPORT_IDENTITY_VERSION
      ? safeNormalizeIdentity(rawFields)
      : undefined;
    const fieldDefinitions = parsed.schemaVersion === 2 && Array.isArray(parsed.fieldDefinitions)
      ? parsed.fieldDefinitions as ReportFieldDefinition[]
      : undefined;
    const templateId = typeof parsed.templateId === "string" ? parsed.templateId : "custom";
    const contract = { templateId, schemaVersion: parsed.schemaVersion, fieldDefinitions };
    return {
      baseRevision: Number(parsed.baseRevision),
      updatedAt: parsed.updatedAt,
      schemaVersion: parsed.schemaVersion,
      templateVersionId: typeof parsed.templateVersionId === "string" ? parsed.templateVersionId : undefined,
      templateId,
      themeId: typeof parsed.themeId === "string" ? parsed.themeId : "classic",
      fontFamily: typeof parsed.fontFamily === "string" ? parsed.fontFamily : "Cairo",
      fields: editorFieldValues(contract, rawFields),
      evidenceAssetIds: Array.isArray(parsed.evidenceAssetIds)
        ? parsed.evidenceAssetIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
        : [],
      reportIdentity: safeNormalizeIdentity(parsed.reportIdentity) ?? legacyIdentity,
      fieldDefinitions,
    };
  } catch {
    return undefined;
  }
}

const saveStateText: Record<SaveState, string> = {
  idle: "جاهز",
  dirty: "تغييرات غير محفوظة",
  saving: "جارٍ الحفظ...",
  saved: "محفوظ في الخادم",
  offline: "غير متصل بالخادم",
  conflict: "يوجد تعارض مع نسخة أحدث",
  error: "تعذر الحفظ",
};

export default function WorkReportEditor() {
  const [, params] = useRoute<{ id: string }>("/work/:id/report");
  const workId = Number(params?.id);
  if (!Number.isInteger(workId) || workId <= 0) {
    return <div className="min-h-screen bg-[#F8FAFC] p-8 text-sm text-red-700" dir="rtl">معرّف العمل غير صالح.</div>;
  }
  return <ReportEditor key={workId} workId={workId} />;
}

function ReportEditor({ workId }: { workId: number }) {
  const [location, setLocation] = useLocation();
  const sessionRef = useRef<ReportDraftSession | null>(null);
  const scope = useRef(localStorage.activeScope);
  const conflict = useRef(false);
  const backupRevision = useRef(0);
  const versionPending = useRef(false);
  const logoRequest = useRef(0);
  const logoPending = useRef(false);

  const [creatingVersion, setCreatingVersion] = useState(false);
  const [processingLogo, setProcessingLogo] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const { templateId, themeId, fontFamily, fields, evidenceAssetIds, reportIdentity } = draft;
  const institution = reportInstitution(reportIdentity);
  const nonEmptySigners = institution.signers.filter(signer => signer.name.trim().length > 0);
  const selectedFont = reportFontFamily(fontFamily);

  const [mobileView, setMobileView] = useState<MobileView>("edit");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [backupError, setBackupError] = useState(false);
  const [copiedLocalEdits, setCopiedLocalEdits] = useState(false);
  const [copyLocalError, setCopyLocalError] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [versionReason, setVersionReason] = useState("");
  const [templateError, setTemplateError] = useState<string | undefined>();
  const [pendingTargetTemplateId, setPendingTargetTemplateId] = useState<string | null>(null);
  const [templateSwitchError, setTemplateSwitchError] = useState<string | undefined>();
  const [templateSwitchNotice, setTemplateSwitchNotice] = useState<{ historyId: string; revision: number } | null>(null);
  const [confirmRestoreHistoryId, setConfirmRestoreHistoryId] = useState<string | null>(null);
  const [confirmRestoreVersionId, setConfirmRestoreVersionId] = useState<number | null>(null);
  const [versionRestoreNotice, setVersionRestoreNotice] = useState<string | undefined>();
  const [showLegacyImport, setShowLegacyImport] = useState(false);
  const legacyImportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const templateSelectRef = useRef<HTMLSelectElement | null>(null);
  const [createdVersion, setCreatedVersion] = useState<{ id: number; versionNumber: number; revision: number } | undefined>();
  const [selectedReviewerId, setSelectedReviewerId] = useState<number | undefined>();
  const [identityAutoFillNotice, setIdentityAutoFillNotice] = useState<string | undefined>();

  const utils = trpc.useUtils();
  const reportQuery = trpc.domain.reportDraft.get.useQuery(
    { workItemId: workId },
    { retry: false, refetchOnWindowFocus: false, refetchOnMount: "always" },
  );
  const workQuery = trpc.domain.work.get.useQuery(
    { id: workId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const organizationId = workQuery.data?.ownerType === "organization"
    ? workQuery.data.ownerOrganizationId ?? undefined
    : undefined;
  const organizationsQuery = trpc.domain.organization.listMine.useQuery(undefined, {
    enabled: Boolean(organizationId),
    retry: false,
  });
  const reviewersQuery = trpc.reviewSupport.reviewers.useQuery(
    { organizationId: organizationId ?? 0 },
    { enabled: Boolean(organizationId), retry: false },
  );
  const versionsQuery = trpc.reviewSupport.versions.useQuery(
    { workItemId: workId },
    { enabled: Boolean(reportQuery.data), retry: false, refetchOnWindowFocus: false },
  );
  const templateHistoryQuery = trpc.domain.reportDraft.templateHistory.useQuery(
    { workItemId: workId },
    { enabled: Boolean(reportQuery.data), retry: false, refetchOnWindowFocus: false },
  );
  const previewSwitchQuery = trpc.domain.reportDraft.previewTemplateSwitch.useQuery(
    { workItemId: workId, targetTemplateId: pendingTargetTemplateId ?? "custom" },
    { enabled: Boolean(pendingTargetTemplateId), retry: false, refetchOnWindowFocus: false },
  );

  const { mutateAsync: writeDraft } = trpc.domain.reportDraft.save.useMutation();
  const switchTemplateMutation = trpc.domain.reportDraft.switchTemplate.useMutation();
  const rollbackTemplateMutation = trpc.domain.reportDraft.rollbackTemplate.useMutation();
  const restoreVersionMutation = trpc.domain.reportDraft.restoreVersion.useMutation();
  const createVersionMutation = trpc.domain.reportDraft.createVersion.useMutation();
  const requestReviewMutation = trpc.domain.review.request.useMutation();

  const isCurrent = useCallback((session: ReportDraftSession) =>
    sessionRef.current === session && scope.current === localStorage.activeScope, []);
  useLayoutEffect(() => () => { sessionRef.current = null; }, []);

  const updateBackup = useCallback((pending?: { content: ReportDraftContent; baseRevision: number }) => {
    try {
      if (pending) {
        const backup: LocalBackup = { ...pending.content, baseRevision: pending.baseRevision, updatedAt: new Date().toISOString() };
        localStorage.setItem(backupKey(workId), JSON.stringify(backup));
      } else {
        localStorage.removeItem(backupKey(workId));
      }
      setBackupError(false);
    } catch {
      // A device storage error must not interrupt saving to the server.
      setBackupError(true);
    }
  }, [workId]);

  const applyServerDraft = useCallback((data: NonNullable<typeof reportQuery.data>, recover: boolean) => {
    logoRequest.current++;
    logoPending.current = false;
    setProcessingLogo(false);
    setLogoError(false);
    setCopiedLocalEdits(false);
    setCopyLocalError(false);
    const contract = {
      templateId: data.draft.templateId,
      schemaVersion: data.draft.schemaVersion,
      fieldDefinitions: data.draft.fieldDefinitions ? [...data.draft.fieldDefinitions] : undefined,
    };
    const confirmed = contentOf({
      ...data.draft,
      fieldDefinitions: contract.fieldDefinitions,
      fields: editorFieldValues(contract, data.draft.fields),
      reportIdentity: safeNormalizeIdentity(data.draft.reportIdentity),
    });
    const backup = recover ? parseBackup(workId) : undefined;
    const unsaved = backup && !sameContent(confirmed, backup) ? backup : undefined;
    const session = new ReportDraftSession(data.draft.revision, confirmed, unsaved && contentOf(unsaved));
    sessionRef.current = session;
    // An earlier save may have landed while this page was closed. Keep the
    // local edits visible for reconciliation instead of replaying a stale base.
    backupRevision.current = unsaved?.baseRevision ?? session.revision;
    versionPending.current = false;
    setCreatingVersion(false);
    conflict.current = Boolean(unsaved && unsaved.baseRevision !== session.revision);
    if (backup && !unsaved) updateBackup();
    setDraft(session.content);
    setRevision(session.revision);
    setLastSavedAt(data.draft.updatedAt);
    setTemplateError(undefined);
    setCreatedVersion(undefined);
    setSaveState(conflict.current ? "conflict" : session.dirty ? (navigator.onLine ? "dirty" : "offline") : "saved");
  }, [workId, updateBackup]);

  useEffect(() => {
    if (reportQuery.data && reportQuery.isSuccess && !reportQuery.isFetching && !sessionRef.current) {
      applyServerDraft(reportQuery.data, true);
    }
  }, [applyServerDraft, reportQuery.data, reportQuery.isFetching, reportQuery.isSuccess]);

  const editDraft = (changes: Partial<ReportDraftContent> | ((current: ReportDraftContent) => Partial<ReportDraftContent>)) => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session)) return;
    setDraft(session.edit(typeof changes === "function" ? changes(session.content) : changes));
    setCreatedVersion(undefined);
    // During a conflict the backup must keep its original revision until the
    // user chooses to discard it. Editing it must never unlock an overwrite.
    updateBackup({ content: session.content, baseRevision: backupRevision.current });
    if (!conflict.current) setSaveState(navigator.onLine ? "dirty" : "offline");
  };

  const editIdentity = (patch: Partial<Omit<ReportIdentity, "version">>) => editDraft(current => {
    const next: ReportIdentity = {
      version: REPORT_IDENTITY_VERSION,
      ...(current.reportIdentity ?? {}),
      ...patch,
    };
    const hasAny = Boolean(
      next.schoolName ||
      next.reportPreparer ||
      next.schoolPrincipal ||
      next.ministryLogo ||
      next.schoolLogoPng,
    );
    return { reportIdentity: hasAny ? next : undefined };
  });

  const handleAutoFillIdentity = () => {
    const { personalInfo, profile } = useUserStore.getState();
    const orgName = organizationsQuery.data?.find(org => org.id === organizationId)?.name?.trim();
    const patch = buildReportIdentityDefaults({
      organizationName: orgName,
      department: personalInfo.department,
      fullName: profile.fullName,
      preparer: personalInfo.preparer,
      principalName: personalInfo.principalName,
      gender: normalizeEducatorGender(personalInfo.gender),
      roleKey: personalInfo.roleKey ? normalizeEducatorRoleKey(personalInfo.roleKey) : undefined,
      existing: reportIdentity,
    });
    if (Object.keys(patch).length === 0) {
      setIdentityAutoFillNotice("لم تُعدل الحقول المملوءة يدويًا أو لا توجد بيانات حساب/مدرسة محفوظة للتعبئة.");
      return;
    }
    editIdentity(patch);
    setIdentityAutoFillNotice("تمت تعبئة الحقول الفارغة من بيانات الحساب/المدرسة دون تعديل أي إدخال يدوي.");
  };

  const changeSchoolLogo = async (file: File) => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || versionPending.current) return;
    const request = ++logoRequest.current;
    logoPending.current = true;
    setProcessingLogo(true);
    setLogoError(false);
    try {
      const logo = await prepareSchoolLogo(file);
      if (isCurrent(session) && request === logoRequest.current) editIdentity({ schoolLogoPng: logo });
    } catch {
      if (isCurrent(session) && request === logoRequest.current) setLogoError(true);
    } finally {
      if (isCurrent(session) && request === logoRequest.current) {
        logoPending.current = false;
        setProcessingLogo(false);
      }
    }
  };

  const changeTemplate = async (nextTemplateId: string) => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || nextTemplateId === session.content.templateId) return;
    if (session.content.schemaVersion === 2) {
      if (conflict.current) {
        setTemplateError("حل تعارض المسودة أولًا قبل تبديل القالب.");
        return;
      }
      if (!navigator.onLine) {
        setTemplateError("تبديل القالب يتطلب اتصالًا بالخادم لحفظ تعديلاتك أولًا.");
        return;
      }
      setTemplateError(undefined);
      setTemplateSwitchError(undefined);
      const flushedRevision = await saveDraft();
      if (!isCurrent(session) || conflict.current || session.dirty || flushedRevision === undefined) {
        if (!conflict.current) {
          setTemplateError("تعذر حفظ التعديلات المعلقة قبل تبديل القالب. حاول مرة أخرى.");
        }
        return;
      }
      setPendingTargetTemplateId(nextTemplateId);
      return;
    }
    const next = REPORT_TEMPLATE_DEFINITIONS[nextTemplateId];
    if (!next) {
      setTemplateError("القالب المطلوب غير متاح، ولم تتغير البيانات.");
      return;
    }
    setTemplateError(undefined);
    editDraft({ templateId: next.id, templateVersionId: `${next.id}@${next.version}`, fieldDefinitions: [...next.fields] });
  };

  const handleApplyTemplateSwitch = async (strategy: "append_to_summary" | "discard") => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || !pendingTargetTemplateId) return;
    setTemplateSwitchError(undefined);
    try {
      const result = await switchTemplateMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: session.revision,
        targetTemplateId: pendingTargetTemplateId,
        unmappedStrategy: strategy,
      });
      if (!isCurrent(session)) return;
      setPendingTargetTemplateId(null);
      setConfirmRestoreHistoryId(null);
      await utils.domain.reportDraft.get.invalidate({ workItemId: workId });
      const refreshed = await reportQuery.refetch();
      if (isCurrent(session) && refreshed.isSuccess) {
        updateBackup();
        applyServerDraft(refreshed.data, false);
        setTemplateSwitchNotice({ historyId: result.historyId, revision: result.revision });
      }
      await utils.domain.reportDraft.templateHistory.invalidate({ workItemId: workId });
    } catch (error) {
      if (!isCurrent(session)) return;
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (code === "CONFLICT") {
        conflict.current = true;
        setSaveState("conflict");
        setPendingTargetTemplateId(null);
        return;
      }
      setTemplateSwitchError(error instanceof Error ? error.message : "تعذر تبديل القالب.");
    }
  };

  const handleRollbackTemplate = async (historyId: string, expectedRev?: number) => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || conflict.current) return;
    setTemplateError(undefined);
    try {
      let currentRevision = expectedRev ?? session.revision;
      if (session.dirty) {
        const flushed = await saveDraft();
        if (!isCurrent(session) || conflict.current || flushed === undefined) return;
        currentRevision = flushed;
      }
      await rollbackTemplateMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: currentRevision,
        historyId,
      });
      if (!isCurrent(session)) return;
      setTemplateSwitchNotice(null);
      setConfirmRestoreHistoryId(null);
      await utils.domain.reportDraft.get.invalidate({ workItemId: workId });
      const refreshed = await reportQuery.refetch();
      if (isCurrent(session) && refreshed.isSuccess) {
        updateBackup();
        applyServerDraft(refreshed.data, false);
      }
      await utils.domain.reportDraft.templateHistory.invalidate({ workItemId: workId });
    } catch (error) {
      if (!isCurrent(session)) return;
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (code === "CONFLICT") {
        conflict.current = true;
        setSaveState("conflict");
        return;
      }
      setTemplateError(error instanceof Error ? error.message : "تعذر التراجع عن القالب.");
    }
  };

  const saveDraft = useCallback(async (): Promise<number | undefined> => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || conflict.current) return;
    if (!navigator.onLine) { setSaveState("offline"); return; }
    try {
      return await session.flush(async (content, expectedRevision) => {
        if (!isCurrent(session) || !navigator.onLine) throw new Error("Report session unavailable");
        setSaveState("saving");
        const fieldDefinitions = content.fieldDefinitions?.map(field => ({
          key: field.key,
          label: field.label,
          type: field.type,
          ...(field.placeholder !== undefined ? { placeholder: field.placeholder } : {}),
          ...(field.options ? { options: [...field.options] } : {}),
          ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
          ...(field.rows !== undefined ? { rows: field.rows } : {}),
        }));
        return writeDraft({
          workItemId: workId,
          expectedRevision,
          schemaVersion: content.schemaVersion,
          templateId: content.templateId,
          templateVersionId: content.templateVersionId,
          themeId: content.themeId,
          fontFamily: content.fontFamily,
          fieldDefinitions,
          fields: serverFieldValues(content, content.fields),
          evidenceAssetIds: content.evidenceAssetIds,
          reportIdentity: safeNormalizeIdentity(content.reportIdentity),
        });
      }, receipt => {
        if (!isCurrent(session)) return;
        backupRevision.current = receipt.revision;
        setRevision(receipt.revision);
        setLastSavedAt(receipt.updatedAt);
        if (session.dirty) {
          updateBackup({ content: session.content, baseRevision: receipt.revision });
        } else {
          updateBackup();
          setSaveState("saved");
        }
      });
    } catch (error) {
      if (isCurrent(session)) {
        conflict.current = (error as { data?: { code?: string } })?.data?.code === "CONFLICT";
        setSaveState(conflict.current ? "conflict" : navigator.onLine ? "error" : "offline");
      }
    }
  }, [isCurrent, workId, writeDraft, updateBackup]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void saveDraft(), 1400);
    return () => window.clearTimeout(timer);
  }, [draft, saveDraft, saveState]);

  useEffect(() => {
    const online = () => { if (sessionRef.current?.dirty && !conflict.current) void saveDraft(); };
    const offline = () => { if (sessionRef.current?.dirty && !conflict.current) setSaveState("offline"); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [saveDraft]);

  const reloadFromServer = async () => {
    const session = sessionRef.current;
    const result = await reportQuery.refetch();
    if (session && isCurrent(session) && result.isSuccess) {
      updateBackup();
      applyServerDraft(result.data, false);
    }
  };

  const copyLocalEdits = async () => {
    setCopyLocalError(false);
    const definitions = editorFields(draft);
    const lines: string[] = [];
    if (workQuery.data?.title) lines.push(`العنوان: ${workQuery.data.title}`);
    if (institution.schoolName) lines.push(`اسم المدرسة: ${institution.schoolName}`);
    for (const signer of nonEmptySigners) {
      lines.push(`${signer.label}: ${signer.name}`);
    }
    for (const field of definitions) {
      const value = fields[field.key]?.trim();
      if (value) lines.push(`\n## ${field.label}\n${value}`);
    }
    const textPayload = lines.join("\n").trim() || JSON.stringify({ fields, reportIdentity: safeNormalizeIdentity(reportIdentity) }, null, 2);
    try {
      await navigator.clipboard.writeText(textPayload);
      setCopiedLocalEdits(true);
      window.setTimeout(() => setCopiedLocalEdits(false), 2500);
    } catch {
      setCopyLocalError(true);
    }
  };

  const handleCreateVersion = async () => {
    const session = sessionRef.current;
    if (!session || versionPending.current || logoPending.current || conflict.current || !navigator.onLine) return;
    versionPending.current = true;
    setCreatingVersion(true);
    try {
      const currentRevision = await saveDraft();
      if (!currentRevision || !isCurrent(session) || session.dirty) return;
      const submitted = session.content;
      const version = await createVersionMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: currentRevision,
        reason: versionReason.trim() || undefined,
      });
      if (!isCurrent(session)) return;
      if (session.content === submitted) {
        setCreatedVersion({ id: version.id, versionNumber: version.versionNumber, revision: currentRevision });
      }
      setVersionReason("");
      await Promise.all([
        utils.domain.work.get.invalidate({ id: workId }),
        utils.domain.work.list.invalidate(),
        utils.reviewSupport.versions.invalidate({ workItemId: workId }),
      ]);
    } catch (error) {
      if (isCurrent(session) && (error as { data?: { code?: string } })?.data?.code === "CONFLICT") {
        conflict.current = true;
        setSaveState("conflict");
      }
    } finally {
      if (isCurrent(session)) {
        versionPending.current = false;
        setCreatingVersion(false);
      }
    }
  };

  const handleRestoreVersionAsDraft = async (versionId: number) => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || conflict.current) return;
    setTemplateError(undefined);
    setVersionRestoreNotice(undefined);
    try {
      let currentRevision = session.revision;
      if (session.dirty) {
        const flushed = await saveDraft();
        if (!isCurrent(session) || conflict.current || flushed === undefined) return;
        currentRevision = flushed;
      }
      const result = await restoreVersionMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: currentRevision,
        versionId,
      });
      if (!isCurrent(session)) return;
      setConfirmRestoreVersionId(null);
      await utils.domain.reportDraft.get.invalidate({ workItemId: workId });
      const refreshed = await reportQuery.refetch();
      if (isCurrent(session) && refreshed.isSuccess) {
        updateBackup();
        applyServerDraft(refreshed.data, false);
        setVersionRestoreNotice(`تمت استعادة النسخة ${result.restoredFromVersionNumber} كمسودة قابلة للتعديل دون تعديل النسخ السابقة.`);
      }
      await utils.domain.reportDraft.templateHistory.invalidate({ workItemId: workId });
    } catch (error) {
      if (!isCurrent(session)) return;
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (code === "CONFLICT") {
        conflict.current = true;
        setSaveState("conflict");
        return;
      }
      setTemplateError(error instanceof Error ? error.message : "تعذر استعادة النسخة.");
    }
  };

  const handleLegacyImport = (importedFields: Record<string, string>) => {
    editDraft(current => {
      const merged = { ...current.fields };
      for (const [key, value] of Object.entries(importedFields)) {
        if (!value) continue;
        merged[key] = merged[key]?.trim() ? `${merged[key]}\n\n${value}` : value;
      }
      return { fields: merged };
    });
  };

  const handleRequestReview = async () => {
    if (!createdVersion || !selectedReviewerId) return;
    await requestReviewMutation.mutateAsync({
      workVersionId: createdVersion.id,
      reviewerUserId: selectedReviewerId,
    });
    await Promise.all([
      utils.domain.review.list.invalidate(),
      utils.domain.work.get.invalidate({ id: workId }),
      utils.domain.work.list.invalidate(),
    ]);
    setLocation("/reviews");
  };

  const linkedAssets = workQuery.data?.assets ?? [];
  const selectedEvidence = useMemo(
    () => linkedAssets.filter(asset => evidenceAssetIds.includes(asset.id)),
    [evidenceAssetIds, linkedAssets],
  );
  const fieldDefinitions = editorFields(draft);
  const previewModel = useMemo(() => {
    try {
      return projectReportDocument({
        reportDraft: {
          ...draft,
          fields: serverFieldValues(draft, fields),
          reportIdentity: safeNormalizeIdentity(reportIdentity),
        },
        assets: selectedEvidence.map(asset => ({ id: asset.id, title: asset.title, kind: asset.kind, role: asset.role, caption: asset.caption })),
      });
    } catch {
      return undefined;
    }
  }, [draft, fields, reportIdentity, selectedEvidence, templateId]);

  const inputClassName = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-8" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <button type="button" onClick={() => setLocation(`/work/${workId}`)} className="mr-12 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-700 hover:text-teal-700 lg:mr-0">
                <ArrowRight className="h-4 w-4" /> العودة إلى العمل
              </button>
              <div className="mt-3 flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-teal-700">محرر التقرير المرتبط بالعمل</p>
                  <h1 className="text-xl font-black text-slate-950 [overflow-wrap:anywhere] sm:text-2xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                    {reportQuery.data?.work.title || workQuery.data?.title || "جاري تحميل التقرير..."}
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                  saveState === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : saveState === "conflict" ? "border-amber-200 bg-amber-50 text-amber-900"
                      : saveState === "error" ? "border-red-200 bg-red-50 text-red-700"
                        : saveState === "offline" ? "border-slate-300 bg-slate-100 text-slate-700"
                          : "border-teal-200 bg-teal-50 text-teal-800"
                }`}
              >
                {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" />
                  : saveState === "offline" ? <CloudOff className="h-4 w-4" />
                    : saveState === "saved" ? <CheckCircle2 className="h-4 w-4" />
                      : saveState === "conflict" ? <ShieldAlert className="h-4 w-4" />
                        : <Cloud className="h-4 w-4" />}
                {saveStateText[saveState]}
              </div>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saveState === "saving" || saveState === "saved" || saveState === "conflict" || saveState === "idle"}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الآن
              </button>
            </div>
          </div>

          {(workQuery.isLoading || (saveState === "idle" && !reportQuery.error && !workQuery.error)) && (
            <div role="status" className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-600"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل بيانات التقرير...</div>
          )}

          {(reportQuery.error || workQuery.error) && (
            <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
              <p>{reportQuery.error?.message || workQuery.error?.message}</p>
              <button
                type="button"
                disabled={reportQuery.isFetching || workQuery.isFetching}
                onClick={() => void Promise.all([reportQuery.refetch(), workQuery.refetch()])}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 font-bold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />إعادة تحميل التقرير
              </button>
            </div>
          )}

          {backupError && (
            <p role="alert" className="mt-4 text-sm text-amber-900">تعذّر تحديث نسخة الاسترداد على هذا الجهاز. أبقِ التقرير مفتوحًا حتى يكتمل الحفظ في الخادم.</p>
          )}

          {saveState === "conflict" && (
            <div role="alert" className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">تختلف مراجعة الخادم عن مسودتك المحلية.</p>
                  <p className="mt-1 text-xs leading-6 text-amber-900">انسخ تعديلاتك المحلية أولًا لتفادي فقدان أي نص، ثم اعتمد نسخة الخادم الأحدث.</p>
                  {copiedLocalEdits && <p role="status" className="mt-1 text-xs font-bold text-emerald-800">تم نسخ تعديلاتك المحلية إلى الحافظة.</p>}
                  {copyLocalError && <p role="alert" className="mt-1 text-xs font-bold text-red-700">تعذّر النسخ التلقائي. يمكنك تحديد النص يدويًا من الحقول أدناه قبل اعتماد نسخة الخادم.</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyLocalEdits()}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                >
                  {copiedLocalEdits ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  نسخ تعديلاتي المحلية
                </button>
                <button
                  type="button"
                  onClick={() => void reloadFromServer()}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white hover:bg-amber-950"
                >
                  <RefreshCw className="h-4 w-4" />اعتماد نسخة الخادم
                </button>
              </div>
            </div>
          )}

          {saveState !== "idle" && reportQuery.data && workQuery.data && (
            <>
              {workQuery.data.ownerType === "personal" && (
                <aside className="mt-5 flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-xs leading-6 text-teal-950" aria-label="توضيح مساحة التقرير الشخصي">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <p>
                    هذا تقرير شخصي محفوظ في حسابك: يمكنك التحرير والحفظ التلقائي وإنشاء نسخ ثابتة وتنزيل PDF وWord بشكل خاص مباشرة، دون الحاجة للانضمام إلى مدرسة أو إرسال للمراجعة.
                  </p>
                </aside>
              )}

              <div className="sticky top-2 z-30 mt-5 xl:hidden" role="group" aria-label="تبديل العرض بين التحرير والمعاينة">
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
                  <button
                    type="button"
                    aria-pressed={mobileView === "edit"}
                    onClick={() => setMobileView("edit")}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${mobileView === "edit" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <PencilLine className="h-4 w-4" /> التحرير
                  </button>
                  <button
                    type="button"
                    aria-pressed={mobileView === "preview"}
                    onClick={() => setMobileView("preview")}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${mobileView === "preview" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <Eye className="h-4 w-4" /> معاينة A4
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.78fr)]">
                <div className={`space-y-6 ${mobileView === "preview" ? "hidden xl:block" : "block"}`}>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="text-xs font-bold text-slate-700">نوع التقرير
                        <select ref={templateSelectRef} value={templateId} onChange={event => void changeTemplate(event.target.value)} className={inputClassName}>
                          {!templateOptions.some(option => option.id === templateId) && <option value={templateId}>القالب التاريخي ({templateId})</option>}
                          {templateOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-700">الطابع البصري
                        <select value={themeId} onChange={event => editDraft({ themeId: event.target.value })} className={inputClassName}>
                          {themeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-700">الخط
                        <select value={selectedFont} onChange={event => editDraft({ fontFamily: event.target.value })} className={inputClassName}>
                          {selectedFont === "Arial" && <option value="Arial">Arial</option>}
                          {REPORT_FONT_FAMILIES.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs leading-6 text-slate-600">عند تغيير القالب يعرض المحرر معاينة توافق الحقول قبل التطبيق، ويحفظ نسخة من القالب السابق لإمكانية التراجع دون فقدان أي نص.</p>
                      <button
                        ref={legacyImportTriggerRef}
                        type="button"
                        onClick={() => setShowLegacyImport(true)}
                        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                      >
                        استيراد مسودة قديمة
                      </button>
                    </div>
                    {templateSwitchNotice && (
                      <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-900">
                        <span>تم تبديل القالب</span>
                        <button
                          type="button"
                          disabled={rollbackTemplateMutation.isPending}
                          onClick={() => void handleRollbackTemplate(templateSwitchNotice.historyId, templateSwitchNotice.revision)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {rollbackTemplateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          تراجع
                        </button>
                      </div>
                    )}
                    {templateError && <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">{templateError}</p>}
                    {(templateHistoryQuery.data?.length ?? 0) > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="text-xs font-bold text-slate-800">سجل القوالب</p>
                        <ul className="mt-2 space-y-1.5">
                          {(templateHistoryQuery.data ?? []).map(entry => (
                            <li key={entry.historyId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                              <span className="font-semibold text-slate-800">
                                {entry.fromTemplateLabel} · <span className="font-normal text-slate-600">{renderBidiText(new Date(entry.switchedAt).toLocaleString("ar-SA"))}</span>
                              </span>
                              {confirmRestoreHistoryId === entry.historyId ? (
                                <span className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={rollbackTemplateMutation.isPending}
                                    onClick={() => void handleRollbackTemplate(entry.historyId)}
                                    className="min-h-11 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                                  >
                                    تأكيد الاستعادة
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRestoreHistoryId(null)}
                                    className="min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                                  >
                                    إلغاء
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={rollbackTemplateMutation.isPending}
                                  onClick={() => setConfirmRestoreHistoryId(entry.historyId)}
                                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  استعادة
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-slate-950">هوية التقرير والتوقيعات (اختياري)</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAutoFillIdentity}
                          disabled={creatingVersion}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
                        >
                          تعبئة من بيانات الحساب/المدرسة
                        </button>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">اختياري</span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-slate-600">اترك هذه الحقول فارغة للتقارير الفردية، أو أضف اسم المدرسة والشعارات والتوقيعات للنسخ الرسمية.</p>
                    {identityAutoFillNotice && (
                      <p role="status" className="mt-2 text-xs font-semibold text-teal-800">{identityAutoFillNotice}</p>
                    )}
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {REPORT_IDENTITY_FIELDS.map(({ key, label }) => (
                        <label key={key} className="text-xs font-bold text-slate-700">{label}
                          <input
                            name={key}
                            value={reportIdentity?.[key] ?? ""}
                            maxLength={REPORT_IDENTITY_TEXT_LIMIT}
                            onChange={event => editIdentity({ [key]: event.target.value || undefined })}
                            className={inputClassName}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-700">
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                        <input
                          name="ministryLogo"
                          type="checkbox"
                          className="h-4 w-4 accent-teal-700"
                          checked={Boolean(reportIdentity?.ministryLogo)}
                          onChange={event => editIdentity({ ministryLogo: event.target.checked ? true : undefined })}
                        />
                        إظهار شعار وزارة التعليم
                      </label>
                      <label className="relative inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-800 hover:bg-slate-100 focus-within:outline-none focus-within:ring-2 focus-within:ring-teal-600 focus-within:ring-offset-2">
                        اختيار شعار المدرسة
                        <input
                          name="schoolLogoPng"
                          type="file"
                          accept="image/png"
                          aria-label="اختيار شعار المدرسة"
                          aria-describedby="school-logo-help"
                          className="sr-only"
                          disabled={creatingVersion}
                          onChange={event => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            if (file) void changeSchoolLogo(file);
                          }}
                        />
                      </label>
                      {institution.schoolLogo && (
                        <div className="flex items-center gap-3">
                          <img
                            src={`data:image/png;base64,${institution.schoolLogo}`}
                            alt="معاينة مصغرة لشعار المدرسة"
                            className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-contain p-1"
                          />
                          <button
                            type="button"
                            disabled={creatingVersion || processingLogo}
                            className="min-h-11 rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            onClick={() => { setLogoError(false); editIdentity({ schoolLogoPng: undefined }); }}
                          >
                            إزالة شعار المدرسة
                          </button>
                        </div>
                      )}
                    </div>
                    <p id="school-logo-help" className="mt-2 text-xs leading-6 text-slate-600">شعار المدرسة: صورة PNG حتى ٢ ميغابايت، تُحفظ مع مسودة التقرير.</p>
                    {institution.schoolLogo && !processingLogo && <p role="status" className="mt-2 text-xs font-semibold text-teal-800">أُضيف شعار المدرسة إلى المسودة.</p>}
                    {processingLogo && <p role="status" className="mt-3 text-xs text-slate-700">جارٍ تجهيز شعار المدرسة...</p>}
                    {logoError && <p role="alert" className="mt-3 text-xs font-semibold text-red-700">تعذّرت قراءة شعار المدرسة. اختر ملف PNG صالحًا حتى 2 ميغابايت.</p>}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-xs font-bold text-teal-700">محتوى التقرير</p><h2 className="mt-1 text-lg font-bold text-slate-950">البيانات الأساسية</h2></div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">مراجعة {revision}</span>
                    </div>
                    <div className="mt-5 space-y-5">
                      {fieldDefinitions.map(field => {
                        const value = fields[field.key] ?? "";
                        const onFieldChange = (nextValue: string) => editDraft(current => ({ fields: { ...current.fields, [field.key]: nextValue } }));
                        return (
                          <label key={field.key} className="block text-xs font-bold text-slate-700">
                            {field.label}
                            {field.type === "select" ? (
                              <select value={value} onChange={event => onFieldChange(event.target.value)} className={inputClassName}>
                                <option value="">اختر قيمة</option>
                                {(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
                              </select>
                            ) : field.type === "date" ? (
                              <input
                                type="date"
                                dir="ltr"
                                value={value}
                                onChange={event => onFieldChange(event.target.value)}
                                className={`${inputClassName} text-right`}
                              />
                            ) : field.type === "number" ? (
                              <input
                                type="number"
                                inputMode="numeric"
                                value={value}
                                onChange={event => onFieldChange(event.target.value)}
                                placeholder={field.placeholder}
                                className={inputClassName}
                              />
                            ) : field.type === "text" ? (
                              <input
                                type="text"
                                value={value}
                                maxLength={field.maxLength ?? 2_000}
                                placeholder={field.placeholder}
                                onChange={event => onFieldChange(event.target.value)}
                                className={inputClassName}
                              />
                            ) : (
                              <>
                                <textarea
                                  value={value}
                                  onChange={event => onFieldChange(event.target.value)}
                                  rows={field.rows ?? (field.type === "list" ? 4 : 3)}
                                  maxLength={field.maxLength ?? 20_000}
                                  placeholder={field.placeholder || (field.type === "list" ? "عنصر في كل سطر" : undefined)}
                                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal leading-7 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                />
                                {field.type === "list" && (
                                  <span className="mt-1 block text-[11px] font-normal text-slate-600">أدخل كل عنصر في سطر مستقل.</span>
                                )}
                              </>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-xs font-bold text-teal-700">الشواهد</p><h2 className="mt-1 text-lg font-bold text-slate-950">تحديد الشواهد المستخدمة داخل التقرير</h2></div>
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">{evidenceAssetIds.length} محدد</span>
                    </div>
                    {linkedAssets.length === 0 ? (
                      <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-600">اربط الشواهد بالعمل أولًا من صفحة تفاصيل العمل، ثم اختر ما يظهر في التقرير.</div>
                    ) : (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {linkedAssets.map(asset => {
                          const checked = evidenceAssetIds.includes(asset.id);
                          return (
                            <label key={`${asset.id}-${asset.role}`} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => editDraft(current => ({
                                  evidenceAssetIds: current.evidenceAssetIds.includes(asset.id)
                                    ? current.evidenceAssetIds.filter(id => id !== asset.id)
                                    : [...current.evidenceAssetIds, asset.id],
                                }))}
                                className="mt-1 h-4 w-4 accent-teal-700"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-slate-900">{asset.title}</span>
                                <span className="mt-1 block text-xs text-slate-600">{evidenceKindLabels[asset.kind]} · شاهد مرتبط</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <p className="text-xs font-bold text-teal-700">نسخة غير قابلة للتغيير</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">حفظ نسخة للمراجعة أو الإخراج</h2>
                    <p className="mt-2 text-xs leading-6 text-slate-600">ينشئ النظام نسخة من المسودة المحفوظة في الخادم والشواهد المرتبطة، لا من الصفحة المعروضة في المتصفح.</p>
                    <textarea value={versionReason} onChange={event => setVersionReason(event.target.value)} rows={2} maxLength={255} placeholder="سبب إنشاء النسخة، مثل: جاهزة للمراجعة" className="mt-4 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                    <button
                      type="button"
                      onClick={() => void handleCreateVersion()}
                      disabled={creatingVersion || processingLogo || saveState === "conflict" || saveState === "offline" || (saveState === "saved" && revision === 0)}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} إنشاء نسخة ثابتة
                    </button>
                    {createVersionMutation.error && <p role="alert" className="mt-3 text-xs text-red-700">{createVersionMutation.error.message}</p>}
                    {createdVersion && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">تم إنشاء النسخة {createdVersion.versionNumber} من مراجعة التقرير {createdVersion.revision}.</p>}
                    {versionRestoreNotice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{versionRestoreNotice}</p>}

                    {(versionsQuery.data?.length ?? 0) > 0 && (
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-800">النسخ الثابتة السابقة</p>
                        <ul className="mt-2 space-y-2">
                          {(versionsQuery.data ?? []).map(version => (
                            <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                              <span className="font-semibold text-slate-800">
                                نسخة {version.versionNumber}{version.reason ? ` — ${version.reason}` : ""}
                              </span>
                              {confirmRestoreVersionId === version.id ? (
                                <span className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={restoreVersionMutation.isPending}
                                    onClick={() => void handleRestoreVersionAsDraft(version.id)}
                                    className="min-h-11 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                                  >
                                    تأكيد الاستعادة
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRestoreVersionId(null)}
                                    className="min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                                  >
                                    إلغاء
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={restoreVersionMutation.isPending || saveState === "conflict"}
                                  onClick={() => setConfirmRestoreVersionId(version.id)}
                                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  استعادة كمسودة قابلة للتعديل
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {createdVersion && organizationId && (
                      <div className="mt-5 border-t border-slate-100 pt-5">
                        <label className="block text-xs font-bold text-slate-700">المراجع
                          <select aria-label="مراجع التقرير" value={selectedReviewerId ?? ""} onChange={event => setSelectedReviewerId(Number(event.target.value) || undefined)} className={inputClassName}>
                            <option value="">اختر مراجعًا من المدرسة</option>
                            {(reviewersQuery.data ?? []).map(reviewer => <option key={reviewer.userId} value={reviewer.userId}>{reviewer.name || `مستخدم ${reviewer.userId}`} — {reviewer.role}</option>)}
                          </select>
                        </label>
                        {reviewersQuery.isLoading && <p role="status" className="mt-2 text-xs text-slate-600">جارٍ تحميل المراجعين...</p>}
                        {reviewersQuery.error && (
                          <div role="alert" className="mt-2 text-xs text-red-700">
                            <p>تعذر تحميل المراجعين.</p>
                            <button type="button" onClick={() => void reviewersQuery.refetch()} className="mt-1 inline-flex min-h-11 items-center gap-1 font-bold underline">إعادة تحميل المراجعين</button>
                          </div>
                        )}
                        {reviewersQuery.isSuccess && reviewersQuery.data.length === 0 && <p className="mt-2 text-xs leading-6 text-slate-600">لا يوجد مراجع مؤهل في المدرسة حاليًا. أضف عضوية بدور مراجع قبل الإرسال.</p>}
                        <button
                          type="button"
                          onClick={() => void handleRequestReview().catch(() => undefined)}
                          disabled={!selectedReviewerId || requestReviewMutation.isPending}
                          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          {requestReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال النسخة للمراجعة
                        </button>
                        {requestReviewMutation.error && <p role="alert" className="mt-3 text-xs text-red-700">{requestReviewMutation.error.message}</p>}
                      </div>
                    )}
                  </section>
                </div>

                <aside className={`${mobileView === "edit" ? "hidden xl:block" : "block"} xl:sticky xl:top-6 xl:h-fit`}>
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div><p className="text-xs font-bold text-teal-700">معاينة لحظية</p><h2 className="mt-1 text-base font-bold text-slate-950">شكل المحتوى قبل إنشاء النسخة</h2></div>
                      <span className="text-[11px] font-bold text-slate-600">ليست مخرجًا معتمدًا</span>
                    </div>
                    <div className="bg-slate-100 p-4 sm:p-6">
                      <article
                        className={`mx-auto min-h-[720px] max-w-[620px] bg-white p-5 shadow-sm [overflow-wrap:anywhere] sm:p-10 ${themeId === "formal" ? "border-t-8 border-teal-700" : themeId === "minimal" ? "border border-slate-200" : "border-t-8 border-slate-800"}`}
                        style={{ fontFamily: selectedFont === "Arial" ? "Arial, sans-serif" : `'SERS ${selectedFont}', sans-serif` }}
                      >
                        <div className="border-b border-slate-200 pb-5 text-center">
                          {(institution.ministryLogo || institution.schoolLogo) && (
                            <div className="mb-4 flex items-center justify-center gap-6">
                              {institution.ministryLogo && <img className="h-16 max-w-[40%] object-contain" src={ministryLogoUrl} alt={REPORT_MINISTRY_LOGO_ALT} />}
                              {institution.schoolLogo && <img className="h-16 max-w-[40%] object-contain" src={`data:image/png;base64,${institution.schoolLogo}`} alt={REPORT_SCHOOL_LOGO_ALT} />}
                            </div>
                          )}
                          {institution.schoolName && <p className="mb-2 break-words text-sm font-bold text-slate-800">{renderBidiText(institution.schoolName)}</p>}
                          <h2 className="mt-1 text-xl font-black text-slate-950">{renderBidiText(workQuery.data.title)}</h2>
                          <p className="mt-2 text-xs text-slate-600">{previewModel?.template.label || templateOptions.find(option => option.id === templateId)?.label || templateId}</p>
                        </div>
                        <div className="mt-6 space-y-6">
                          {!previewModel || previewModel.fields.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-600">ابدأ بإدخال بيانات التقرير لتظهر المعاينة هنا.</div>
                          ) : previewModel.fields.map(field => (
                            <section key={field.key}>
                              <h3 className="text-sm font-black text-slate-900">{field.label}</h3>
                              {Array.isArray(field.value) ? (
                                <ul className="mt-2 list-disc space-y-1 pr-5 text-sm leading-7 text-slate-700">
                                  {field.value.map((item, idx) => <li key={idx}>{renderBidiText(item)}</li>)}
                                </ul>
                              ) : (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-8 text-slate-700">{renderBidiText(String(field.value))}</p>
                              )}
                            </section>
                          ))}
                          {selectedEvidence.length > 0 && (
                            <section>
                              <h3 className="text-sm font-black text-slate-900">الشواهد المرفقة</h3>
                              <div className="mt-3 space-y-2">
                                {selectedEvidence.map(asset => (
                                  <div key={asset.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                                    <div>{renderBidiText(asset.title)} · {evidenceKindLabels[asset.kind]}</div>
                                    {asset.kind === "file" && <div className="mt-1 rounded border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">الصورة لا تُقرأ من رابط أو مصدر متغير؛ ستظهر هنا فقط بعد تثبيتها داخل النسخة.</div>}
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}
                          {nonEmptySigners.length > 0 && (
                            <div className={`grid gap-4 border-t border-slate-200 pt-5 text-center ${nonEmptySigners.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                              {nonEmptySigners.map(({ label, name }) => (
                                <div key={label} className="min-w-0 break-words">
                                  <p className="text-xs font-bold text-slate-800">{label}</p>
                                  <p className="mt-2 text-sm text-slate-900">{renderBidiText(name)}</p>
                                  <div className="mx-auto mt-5 w-3/4 border-b border-slate-400" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    </div>
                  </section>
                  <p className="mt-3 text-center text-xs leading-5 text-slate-600">المعاينة مبنية من نفس ReportDocumentModel، لكنها ليست parity كاملة مع PDF/Word: الصور غير المثبتة والفواصل تُعرض كعلامات صريحة، والمخرج النهائي قد يضيف صفحات.</p>
                  {lastSavedAt && <p className="mt-1 text-center text-[11px] text-slate-600">آخر حفظ خادمي: {renderBidiText(new Date(lastSavedAt).toLocaleString("ar-SA"))}</p>}
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      <TemplateSwitchDialog
        open={Boolean(pendingTargetTemplateId)}
        onOpenChange={open => {
          if (!open) {
            setPendingTargetTemplateId(null);
            setTemplateSwitchError(undefined);
          }
        }}
        currentTemplateLabel={templateOptions.find(option => option.id === templateId)?.label ?? templateId}
        preview={previewSwitchQuery.data}
        isLoading={previewSwitchQuery.isLoading}
        isSubmitting={switchTemplateMutation.isPending}
        errorMessage={templateSwitchError || previewSwitchQuery.error?.message}
        onApply={strategy => void handleApplyTemplateSwitch(strategy)}
        returnFocusRef={templateSelectRef}
      />

      <LegacyReportImportDialog
        open={showLegacyImport}
        onOpenChange={setShowLegacyImport}
        allowedFieldKeys={fieldDefinitions.map(field => field.key)}
        onImport={handleLegacyImport}
        returnFocusRef={legacyImportTriggerRef}
      />
    </div>
  );
}
