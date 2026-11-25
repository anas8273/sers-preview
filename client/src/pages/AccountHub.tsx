import { useState } from "react";
import { Building2, CalendarDays, Download, Loader2, LogOut, Plus, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  hasLegacyPlaintextUserRecord,
  readLegacyPlaintextUserRecord,
  removeLegacyPlaintextUserRecord,
  privateLocalStorage,
} from "@/lib/private-browser-storage";
import { useUserStore } from "@/stores/userStore";
import {
  EDUCATOR_ROLE_KEYS,
  formatBeneficiaryPlural,
  formatEducatorRoleLabel,
  normalizeEducatorGender,
  normalizeEducatorRoleKey,
  type EducatorGender,
  type EducatorRoleKey,
} from "@shared/arabic-grammar";

type Role = "owner" | "admin" | "reviewer" | "member";
const roleLabels: Record<Role, string> = { owner: "مالك", admin: "مدير", reviewer: "مراجع", member: "عضو" };
const statusLabels = { active: "نشط", invited: "دعوة بانتظار القبول", suspended: "موقوف", left: "عضوية مسحوبة" };
const field = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm";
const button = "rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";

type LegacyImportStatus = "none" | "available" | "importing" | "imported" | "preserved" | "error";

function isLegacyUserSnapshot(raw: string) {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("state" in parsed)) return false;
    const state = (parsed as { state?: unknown }).state;
    return Boolean(state && typeof state === "object"
      && "personalInfo" in state && "profile" in state
      && typeof (state as { personalInfo?: unknown }).personalInfo === "object"
      && typeof (state as { profile?: unknown }).profile === "object");
  } catch {
    return false;
  }
}

function SchoolMembers({ organizationId, owner }: { organizationId: number; owner: boolean }) {
  const utils = trpc.useUtils();
  const members = trpc.account.members.useQuery({ organizationId }, { retry: false });
  const [targetId, setTargetId] = useState("");
  const [role, setRole] = useState<Role>("member");
  const refresh = async () => { await Promise.all([utils.account.members.invalidate(), utils.account.overview.invalidate(), utils.domain.organization.listMine.invalidate(), utils.domain.work.list.invalidate(), utils.domain.asset.list.invalidate()]); };
  const invite = trpc.account.inviteMember.useMutation({ onSuccess: async () => { setTargetId(""); await refresh(); } });
  const change = trpc.account.setMember.useMutation({ onSuccess: refresh });
  const availableRoles: Role[] = owner ? ["owner", "admin", "reviewer", "member"] : ["reviewer", "member"];
  return <div className="mt-5 border-t border-slate-100 pt-5">
    <h3 className="text-sm font-bold">أعضاء المدرسة</h3>
    <p className="mt-2 text-xs leading-6 text-slate-500">اطلب من العضو معرّف حسابه الظاهر في هذه الصفحة. تظهر الدعوة داخل حسابه وتحتاج قبوله.</p>
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); invite.mutate({ organizationId, targetUserId: Number(targetId), role }); }}>
      <label className="min-w-40 flex-1 text-xs font-bold">معرّف الحساب<input aria-label="معرّف الحساب المدعو" type="number" min="1" required value={targetId} onChange={e => setTargetId(e.target.value)} className={field} /></label>
      <label className="min-w-32 text-xs font-bold">الدور<select aria-label="دور العضو المدعو" value={role} onChange={e => setRole(e.target.value as Role)} className={field}>{availableRoles.map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
      <button className={button} disabled={invite.isPending || !Number.isSafeInteger(Number(targetId)) || Number(targetId) < 1}>إضافة دعوة</button>
    </form>
    {members.isLoading && <p className="mt-3 text-xs">جارٍ تحميل الأعضاء…</p>}
    {(members.error || invite.error || change.error) && <p role="alert" className="mt-3 text-sm text-red-700">{members.error?.message || invite.error?.message || change.error?.message}</p>}
    <div className="mt-4 space-y-3">{members.data?.map(member => <div key={`${member.id}-${member.role}-${member.status}`} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
      <div className="min-w-40 flex-1"><p className="text-sm font-bold">{member.name || `حساب ${member.userId}`}</p><p className="mt-1 text-xs text-slate-500">معرّف {member.userId} · {statusLabels[member.status]}</p></div>
      <select aria-label={`دور الحساب ${member.userId}`} disabled={change.isPending || (!owner && ["owner", "admin"].includes(member.role)) || member.status === "invited"} value={member.role} className="rounded-lg border border-slate-200 p-2 text-xs" onChange={e => change.mutate({ organizationId, membershipId: member.id, role: e.target.value as Role, status: member.status === "invited" ? "suspended" : member.status })}>
        {(owner || ["owner", "admin"].includes(member.role) ? ["owner", "admin", "reviewer", "member"] as Role[] : availableRoles).map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}
      </select>
      {(owner || !["owner", "admin"].includes(member.role)) && <>
        {member.status === "active" && <button className="text-xs font-bold text-amber-800" disabled={change.isPending} onClick={() => change.mutate({ organizationId, membershipId: member.id, role: member.role, status: "suspended" })}>إيقاف</button>}
        {(member.status === "suspended" || member.status === "left") && (member.invitationAccepted
          ? <button className="text-xs font-bold text-teal-800" disabled={change.isPending} onClick={() => change.mutate({ organizationId, membershipId: member.id, role: member.role, status: "active" })}>إعادة التفعيل</button>
          : <button className="text-xs font-bold text-teal-800" disabled={invite.isPending} onClick={() => invite.mutate({ organizationId, targetUserId: member.userId, role: member.role })}>إعادة الدعوة</button>)}
        {member.status !== "left" && <button className="text-xs font-bold text-red-700" disabled={change.isPending} onClick={() => change.mutate({ organizationId, membershipId: member.id, role: member.role, status: "left" })}>{member.status === "invited" ? "إلغاء الدعوة" : "سحب العضوية"}</button>}
      </>}
    </div>)}</div>
  </div>;
}

export default function AccountHub() {
  const [location] = useLocation();
  const { user, logout, loading: authLoading } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [legacyImportStatus, setLegacyImportStatus] = useState<LegacyImportStatus>(() => hasLegacyPlaintextUserRecord() ? "available" : "none");
  const [legacyImportError, setLegacyImportError] = useState("");
  const utils = trpc.useUtils();
  const overview = trpc.account.overview.useQuery(undefined, { retry: false, enabled: Boolean(user) });
  const years = trpc.account.academicYears.useQuery(undefined, { retry: false, enabled: Boolean(user) });
  const [schoolName, setSchoolName] = useState("");
  const [scope, setScope] = useState("personal");
  const [yearLabel, setYearLabel] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [terms, setTerms] = useState([{ label: "الفصل الأول", startsOn: "", endsOn: "" }]);
  const personalInfo = useUserStore(state => state.personalInfo);
  const profile = useUserStore(state => state.profile);
  const setPersonalInfo = useUserStore(state => state.setPersonalInfo);
  const setProfile = useUserStore(state => state.setProfile);
  const activeGender = normalizeEducatorGender(personalInfo.gender);
  const activeRoleKey = normalizeEducatorRoleKey(personalInfo.roleKey);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const [exportSavedNotice, setExportSavedNotice] = useState(false);
  const refresh = async () => { await Promise.all([utils.account.overview.invalidate(), utils.domain.organization.listMine.invalidate(), utils.account.academicYears.invalidate()]); };
  const createSchool = trpc.account.createSchool.useMutation({ onSuccess: async () => { setSchoolName(""); await refresh(); } });
  const accept = trpc.account.acceptInvitation.useMutation({ onSuccess: refresh });
  const createYear = trpc.account.createAcademicYear.useMutation({ onSuccess: async () => { setYearLabel(""); await utils.account.academicYears.invalidate(); } });
  const exportMyData = trpc.account.exportMyData.useMutation({
    onSuccess: bundle => {
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sers-account-export-${bundle.user.id}-${bundle.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      // Defer revocation so Safari/Firefox finish streaming the Blob download cleanly
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportSavedNotice(true);
    },
  });
  const manageable = overview.data?.schools.filter(s => s.status === "active" && ["owner", "admin"].includes(s.role)) ?? [];
  const importLegacyProfile = async () => {
    if (!window.confirm("لا يمكن إثبات مالك النسخة المحلية القديمة تلقائيًا. هل تؤكد أنها تخص هذا الحساب وتريد نسخها إلى الخزنة المشفرة؟ لن تُحذف النسخة الأصلية إلا بعد نجاح الحفظ المشفر.")) return;
    setLegacyImportStatus("importing");
    setLegacyImportError("");
    let sourceRemoved = false;
    try {
      const raw = readLegacyPlaintextUserRecord();
      if (!raw || !isLegacyUserSnapshot(raw)) throw new Error("تعذر التحقق من بنية النسخة القديمة");
      // Commit ciphertext in the current server-provided account scope first.
      await privateLocalStorage.setItemDurably("sers-user", raw);
      await privateLocalStorage.flush();
      try {
        removeLegacyPlaintextUserRecord();
        sourceRemoved = true;
        setLegacyImportStatus("imported");
      } catch {
        // The encrypted copy is safe; retaining the source is preferable to a
        // silent delete when browser storage removal is unavailable.
        setLegacyImportStatus("preserved");
      }
      await useUserStore.persist.rehydrate();
    } catch (error) {
      setLegacyImportStatus(sourceRemoved ? "imported" : "error");
      setLegacyImportError(sourceRemoved ? "" : (error instanceof Error ? error.message : "تعذر حفظ النسخة القديمة بأمان"));
    }
  };
  if (!user) return <div dir="rtl" className="min-h-screen bg-slate-50 pb-24"><AppSidebar currentPath={location} /><main className="px-4 py-8 lg:mr-72"><h1 className="text-3xl font-black text-slate-950">الحساب والمدرسة</h1>{authLoading ? <Loader2 aria-label="جارٍ التحميل" className="mt-6 animate-spin" /> : <a href={getLoginUrl()} className="mt-6 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">تسجيل الدخول</a>}</main></div>;
  return <div dir="rtl" className="min-h-screen bg-slate-50 pb-24 lg:pb-8">
    <AppSidebar currentPath={location} />
    <main className="lg:mr-72"><div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header><p className="text-xs font-bold text-teal-700">الهوية والملكية</p><h1 className="mt-2 text-3xl font-black text-slate-950">الحساب والمدرسة</h1><p className="mt-3 text-sm leading-7 text-slate-500">عضويات واضحة وسنوات دراسية مستقلة تحفظ أعمال كل عام في سياقها.</p></header>
      {user ? <div><button type="button" disabled={authLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50" onClick={() => { setLogoutError(""); void logout().catch(() => setLogoutError("تعذر إنهاء الجلسة الآن. أعد المحاولة حتى يكتمل تسجيل الخروج.")); }}><LogOut className="h-4 w-4" />تسجيل الخروج</button>{logoutError && <p role="alert" className="mt-2 text-sm text-red-700">{logoutError}</p>}</div> : !authLoading && <a href={getLoginUrl()} className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">تسجيل الدخول</a>}
      {legacyImportStatus !== "none" && legacyImportStatus !== "imported" && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-live="polite"><h2 className="font-bold text-amber-950">نسخة محلية قديمة متاحة</h2><p className="mt-2 text-sm leading-7 text-amber-900">لا ننسب هذه النسخة تلقائيًا لأي حساب ولا نعرض محتواها قبل موافقتك. إذا كانت تخص هذا الحساب، يمكنك نسخها إلى الخزنة المشفرة المرتبطة بجلسة الدخول. تبقى النسخة الأصلية حتى ينجح الحفظ.</p>{legacyImportStatus === "available" && <button type="button" className={`${button} mt-3 bg-amber-800`} onClick={() => void importLegacyProfile()}>مراجعة واستيراد النسخة بموافقتي</button>}{legacyImportStatus === "importing" && <p role="status" className="mt-3 text-sm">جارٍ حفظ نسخة مشفرة durable…</p>}{legacyImportStatus === "preserved" && <p role="status" className="mt-3 text-sm">حُفظت النسخة المشفرة، وتعذر حذف الأصل؛ بقي الأصل دون حذف صامت.</p>}{legacyImportStatus === "error" && <p role="alert" className="mt-3 text-sm text-red-800">{legacyImportError || "تعذر الاستيراد؛ بقيت النسخة القديمة دون تغيير."}</p>}</section>}
      {overview.isLoading && <Loader2 aria-label="جارٍ التحميل" className="animate-spin" />}
      {overview.error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">تعذر تحميل الحساب. سجل الدخول ثم أعد المحاولة.</p>}
      {overview.data && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserRound className="h-7 w-7 text-teal-700" />
              <div>
                <h2 className="font-bold">{overview.data.user.name || "حسابي"}</h2>
                <p className="mt-1 text-sm text-slate-600">معرّف حسابك: <strong>{overview.data.user.id}</strong></p>
                {overview.data.user.email && <p className="mt-1 text-xs text-slate-500" dir="ltr">{overview.data.user.email}</p>}
              </div>
            </div>
            <button
              type="button"
              disabled={exportMyData.isPending}
              onClick={() => {
                setExportSavedNotice(false);
                exportMyData.mutate();
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
            >
              {exportMyData.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تصدير نسخة كاملة من بياناتي الشخصية (JSON)
            </button>
          </div>
          {exportSavedNotice && !exportMyData.error && (
            <p role="status" className="mt-2 text-xs font-semibold text-teal-800">تم تجهيز وتنزيل حزمة بياناتك الشخصية (JSON) بنجاح.</p>
          )}
          {exportMyData.error && <p role="alert" className="mt-2 text-xs text-red-700">{exportMyData.error.message}</p>}
        </section>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="تفضيلات الصياغة والتعبئة الافتراضية">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-950">الصياغة العربية والتعبئة الافتراضية للتقارير</h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">تُحفظ هذه التفضيلات في خزنة جهازك الخاصة وتُستخدم فقط عند الضغط على زر التعبئة الاختياري داخل المحرر.</p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
            {formatEducatorRoleLabel(activeRoleKey, activeGender)} · {formatBeneficiaryPlural(activeGender)}
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            الصيغة اللغوية
            <select
              aria-label="الصيغة اللغوية العربية"
              value={activeGender}
              onChange={e => {
                setProfileSavedNotice(false);
                setPersonalInfo({ gender: e.target.value as EducatorGender });
              }}
              className={field}
            >
              <option value="male">مذكر (معلم / الطلاب)</option>
              <option value="female">مؤنث (معلمة / الطالبات)</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            الدور التربوي الافتراضي
            <select
              aria-label="الدور التربوي الافتراضي"
              value={activeRoleKey}
              onChange={e => {
                setProfileSavedNotice(false);
                setPersonalInfo({ roleKey: e.target.value as EducatorRoleKey });
              }}
              className={field}
            >
              {EDUCATOR_ROLE_KEYS.map(key => (
                <option key={key} value={key}>{formatEducatorRoleLabel(key, activeGender)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            اسم مُعدّ التقرير الافتراضي
            <input
              aria-label="اسم معد التقرير الافتراضي"
              value={profile.fullName || personalInfo.preparer}
              onChange={e => {
                setProfileSavedNotice(false);
                setProfile({ fullName: e.target.value });
                setPersonalInfo({ preparer: e.target.value });
              }}
              placeholder="مثال: أمل عبدالله العتيبي"
              className={field}
            />
          </label>
          <label className="text-xs font-bold text-slate-700">
            اسم {formatEducatorRoleLabel("principal", activeGender)} (اختياري)
            <input
              aria-label="اسم قائد أو قائدة المدرسة الافتراضي"
              value={personalInfo.principalName ?? ""}
              onChange={e => {
                setProfileSavedNotice(false);
                setPersonalInfo({ principalName: e.target.value });
              }}
              placeholder={`مثال: اسم ${formatEducatorRoleLabel("principal", activeGender)}`}
              className={field}
            />
          </label>
        </div>
        <label className="mt-4 block text-xs font-bold text-slate-700">
          ترويسة الجهة / المدرسة الافتراضية
          <textarea
            aria-label="ترويسة المدرسة الافتراضية"
            rows={3}
            value={personalInfo.department}
            onChange={e => {
              setProfileSavedNotice(false);
              setPersonalInfo({ department: e.target.value });
            }}
            className={field}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">المسمى المعتمد للتعبئة: <strong>{formatEducatorRoleLabel(activeRoleKey, activeGender)}</strong> · الفئة المستفيدة: <strong>{formatBeneficiaryPlural(activeGender)}</strong></p>
          <button
            type="button"
            onClick={() => setProfileSavedNotice(true)}
            className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
          >
            تأكيد حفظ التفضيلات محليًا
          </button>
        </div>
        {profileSavedNotice && <p role="status" className="mt-2 text-xs font-semibold text-teal-800">تم حفظ تفضيلات الصياغة والتعبئة في خزنة جهازك.</p>}
      </section>
      {overview.data?.schools.filter(s => s.status === "invited").map(school => <section key={school.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-5"><div><h2 className="font-bold">دعوة إلى {school.name}</h2><p className="mt-2 text-sm">الدور المقترح: {roleLabels[school.role]}</p></div><button className={button} disabled={accept.isPending} onClick={() => accept.mutate({ organizationId: school.id })}>قبول الدعوة</button></section>)}
      {accept.error && <p role="alert" className="text-sm text-red-700">{accept.error.message}</p>}
      {overview.data?.schools.filter(s => s.status === "active").map(school => <section key={school.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><Building2 className="h-7 w-7 text-teal-700" /><div><h2 className="font-bold">{school.name}</h2><p className="mt-1 text-xs text-slate-500">دورك: {roleLabels[school.role]}</p></div></div>{["owner", "admin"].includes(school.role) && <SchoolMembers organizationId={school.id} owner={school.role === "owner"} />}</section>)}
      {overview.data && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">إنشاء مساحة مدرسة</h2><p className="mt-2 text-xs leading-6 text-slate-500">ستصبح مالك المساحة، ويمكنك دعوة الحسابات وتوزيع الأدوار بعد إنشائها.</p><form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); createSchool.mutate({ name: schoolName }); }}><label className="flex-1 text-xs font-bold">اسم المدرسة<input aria-label="اسم المدرسة الجديدة" className={field} required minLength={2} maxLength={255} value={schoolName} onChange={e => setSchoolName(e.target.value)} /></label><button className={button} disabled={createSchool.isPending}>إنشاء المدرسة</button></form>{createSchool.error && <p role="alert" className="mt-3 text-sm text-red-700">{createSchool.error.message}</p>}</section>}
      {overview.data && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5 text-teal-700" /> السنوات والفصول الدراسية</h2><p className="mt-2 text-xs leading-6 text-slate-500">أدخل تواريخ الميلادي وفق تقويمك الدراسي. تحفظ تسمية السنة والفصل مع العمل والنسخة التاريخية.</p>
        <div className="mt-4 space-y-2">{years.data?.map(year => <div className="rounded-xl bg-slate-50 p-3" key={year.id}><p className="text-sm font-bold">{year.label} <span className="font-normal text-slate-500">· {year.ownerUserId ? "شخصي" : overview.data?.schools.find(s => s.id === year.organizationId)?.name}</span></p><p className="mt-1 text-xs text-slate-500">{year.terms.map(term => term.label).join(" · ")}</p></div>)}</div>
        <form className="mt-5 space-y-4 border-t border-slate-100 pt-5" onSubmit={e => { e.preventDefault(); createYear.mutate({ ownerType: scope === "personal" ? "personal" : "organization", organizationId: scope === "personal" ? undefined : Number(scope), label: yearLabel, startsOn, endsOn, terms }); }}>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">المساحة<select aria-label="مساحة السنة الدراسية" value={scope} onChange={e => setScope(e.target.value)} className={field}><option value="personal">مساحتي الشخصية</option>{manageable.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-xs font-bold">اسم السنة<input aria-label="اسم السنة الدراسية" required minLength={2} maxLength={100} value={yearLabel} onChange={e => setYearLabel(e.target.value)} placeholder="مثال: 1448–1449هـ" className={field} /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">بداية السنة<input aria-label="بداية السنة الدراسية" required type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} className={field} /></label><label className="text-xs font-bold">نهاية السنة<input aria-label="نهاية السنة الدراسية" required type="date" min={startsOn} value={endsOn} onChange={e => setEndsOn(e.target.value)} className={field} /></label></div>
          {terms.map((term, index) => <fieldset key={index} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3"><legend className="text-xs font-bold">الفصل {index + 1}</legend>{(["label", "startsOn", "endsOn"] as const).map(key => <label key={key} className="text-xs">{key === "label" ? "اسم الفصل" : key === "startsOn" ? "البداية" : "النهاية"}<input aria-label={`الفصل ${index + 1} ${key}`} required type={key === "label" ? "text" : "date"} value={term[key]} onChange={e => setTerms(values => values.map((value, i) => i === index ? { ...value, [key]: e.target.value } : value))} className={field} /></label>)}</fieldset>)}
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-3">{terms.length < 3 && <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-teal-700" onClick={() => setTerms(values => [...values, { label: `الفصل ${values.length + 1}`, startsOn: "", endsOn: "" }])}><Plus className="h-4 w-4" />إضافة فصل</button>}{terms.length > 1 && <button type="button" className="text-xs text-red-700" onClick={() => setTerms(values => values.slice(0, -1))}>إزالة آخر فصل</button>}</div><button className={button} disabled={createYear.isPending}>حفظ السنة والفصول</button></div>
          {(createYear.error || years.error) && <p role="alert" className="text-sm text-red-700">{createYear.error?.message || years.error?.message}</p>}
        </form>
      </section>}
    </div></main>
  </div>;
}
