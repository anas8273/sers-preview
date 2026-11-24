import { useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowLeft, Building2, FileText, FolderKanban, Loader2, Plus, RefreshCw, UserRound, X } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";

const statusLabel = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  archived: "مؤرشف",
} as const;

export default function WorkHub({ reportsOnly = false }: { reportsOnly?: boolean }) {
  const [location, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"report" | "portfolio">("report");
  const [ownerType, setOwnerType] = useState<"personal" | "organization">("personal");
  const [organizationId, setOrganizationId] = useState<number | undefined>();
  const [academicYearId, setAcademicYearId] = useState<number | undefined>();
  const [academicTermId, setAcademicTermId] = useState<number | undefined>();
  const [yearFilter, setYearFilter] = useState("");
  const [termFilter, setTermFilter] = useState<number | undefined>();
  const createTrigger = useRef<HTMLButtonElement | null>(null);

  const openCreate = (event: MouseEvent<HTMLButtonElement>) => {
    createTrigger.current = event.currentTarget;
    setShowCreate(true);
  };

  const utils = trpc.useUtils();
  const workQuery = trpc.domain.work.list.useQuery(
    yearFilter === "unassigned"
      ? { unassigned: true }
      : yearFilter
        ? { academicYearId: Number(yearFilter), academicTermId: termFilter }
        : undefined,
    { retry: false },
  );
  const works = reportsOnly ? workQuery.data?.filter(work => work.type === "report") : workQuery.data;
  const yearsQuery = trpc.account.academicYears.useQuery(undefined, { retry: false });
  const organizationsQuery = trpc.domain.organization.listMine.useQuery(undefined, { retry: false });
  const createWork = trpc.domain.work.create.useMutation({
    onSuccess: async created => {
      setTitle("");
      setType("report");
      setOwnerType("personal");
      setOrganizationId(undefined);
      setAcademicYearId(undefined);
      setAcademicTermId(undefined);
      setShowCreate(false);
      await utils.domain.work.list.invalidate();
      if (created?.id) setLocation(reportsOnly ? `/work/${created.id}/report` : `/work/${created.id}`);
    },
  });

  const organizations = (organizationsQuery.data ?? []).filter(org => ["owner", "admin", "member"].includes(org.role));
  const scopeYears = (yearsQuery.data ?? []).filter(year => ownerType === "personal" ? year.ownerUserId !== null : year.organizationId === organizationId);
  const chosenYear = scopeYears.find(year => year.id === academicYearId);
  const filterYear = yearsQuery.data?.find(year => year.id === Number(yearFilter));

  const yearValidIfSelected = academicYearId === undefined || Boolean(chosenYear);
  const termValidIfSelected = academicTermId === undefined || Boolean(chosenYear && chosenYear.terms.some(term => term.id === academicTermId));
  const canSubmit = useMemo(
    () => title.trim().length >= 2 && yearValidIfSelected && termValidIfSelected && (ownerType === "personal" || Boolean(organizationId)),
    [title, ownerType, organizationId, yearValidIfSelected, termValidIfSelected],
  );

  const selectOwnerType = (next: "personal" | "organization") => {
    setOwnerType(next);
    if (next === "personal") setOrganizationId(undefined);
    setAcademicYearId(undefined);
    setAcademicTermId(undefined);
  };

  const selectOrganization = (nextOrgId: number | undefined) => {
    setOrganizationId(nextOrgId);
    setAcademicYearId(undefined);
    setAcademicTermId(undefined);
  };

  const submit = () => {
    if (!canSubmit || createWork.isPending) return;
    const validYearId = chosenYear?.id;
    const validTermId = validYearId && academicTermId && chosenYear?.terms.some(term => term.id === academicTermId)
      ? academicTermId
      : undefined;
    createWork.mutate({
      title: title.trim(),
      type: reportsOnly ? "report" : type,
      ownerType,
      organizationId: ownerType === "organization" ? organizationId : undefined,
      academicYearId: validYearId,
      academicTermId: validTermId,
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="mr-12 lg:mr-0">
              <p className="text-xs font-bold text-teal-700">مساحة العمل</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>{reportsOnly ? "التقارير" : "أعمالي"}</h1>
              {reportsOnly ? (
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">هذا هو مدخل التقارير الخادمي الجديد: تُحفظ الأعمال والنسخ مع ملكيتها في مساحة العمل. تبقى المسودات القديمة على هذا الجهاز منفصلة ولا تُنقل تلقائيًا.</p>
              ) : <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">التقارير وملفات الإنجاز لها نموذج عمل واحد، مع ملكية واضحة ونسخ محفوظة وشواهد قابلة لإعادة الاستخدام.</p>}
            </div>
            <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800">
              <Plus className="h-4 w-4" /> {reportsOnly ? "إنشاء تقرير" : "إنشاء عمل"}
            </button>
          </header>

          {reportsOnly && (
            <aside className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950" aria-label="تنبيه انتقالي للتقارير القديمة">
              <strong className="block">التقارير المحفوظة على هذا الجهاز — مسار انتقالي</strong>
              <p className="mt-1">يمكنك فتحها وتعديلها محليًا دون حذفها. لا تُعد خدمة خادمية ولا تُدمج تلقائيًا مع التقارير الجديدة.</p>
              <Link href="/reports/legacy" className="mt-2 inline-flex min-h-11 items-center gap-1 font-bold underline underline-offset-4">فتح التقارير القديمة <ArrowLeft className="h-4 w-4" /></Link>
            </aside>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <label className="text-xs font-bold text-slate-700">السنة الدراسية
              <select aria-label="تصفية حسب السنة الدراسية" value={yearFilter} onChange={event => { setYearFilter(event.target.value); setTermFilter(undefined); }} className="mr-2 rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
                <option value="">كل السنوات</option>
                <option value="unassigned">أعمال دون سنة دراسية</option>
                {yearsQuery.data?.map(year => <option key={year.id} value={year.id}>{year.label} — {year.ownerUserId ? "شخصي" : organizationsQuery.data?.find(org => org.id === year.organizationId)?.name || "مدرسي"}</option>)}
              </select>
            </label>
            {filterYear && (
              <label className="text-xs font-bold text-slate-700">الفصل
                <select aria-label="تصفية حسب الفصل الدراسي" value={termFilter ?? ""} onChange={event => setTermFilter(Number(event.target.value) || undefined)} className="mr-2 rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
                  <option value="">كل الفصول</option>
                  {filterYear.terms.map(term => <option key={term.id} value={term.id}>{term.label}</option>)}
                </select>
              </label>
            )}
          </div>

          {workQuery.isLoading && (
            <div role="status" className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-600"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل أعمالك...</div>
          )}

          {workQuery.error && (
            <div role="alert" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
              <p>تعذر تحميل مساحة العمل. تحقق من تسجيل الدخول والاتصال ثم أعد المحاولة.</p>
              <button
                type="button"
                disabled={workQuery.isFetching}
                onClick={() => void workQuery.refetch()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> إعادة المحاولة
              </button>
            </div>
          )}

          {works && works.length === 0 && (
            <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <FolderKanban className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-4 text-base font-bold text-slate-900">{reportsOnly ? "لا توجد تقارير في هذا الاختيار" : yearFilter ? "لا توجد أعمال في هذا الاختيار" : "لا توجد أعمال بعد"}</h2>
              {!reportsOnly && <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-600">أنشئ أول تقرير أو ملف إنجاز. الشواهد التي تضيفها إلى المكتبة ستبقى أصولًا مستقلة يمكن ربطها بأكثر من عمل.</p>}
              <button type="button" onClick={openCreate} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"><Plus className="h-4 w-4" />{reportsOnly ? "إنشاء تقرير جديد" : "إنشاء أول عمل"}</button>
            </section>
          )}

          {works && works.length > 0 && (
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {works.map(work => {
                const Icon = work.type === "report" ? FileText : FolderKanban;
                return (
                  <article key={work.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{statusLabel[work.status]}</span>
                          <span className="text-[11px] font-semibold text-slate-600">نسخة {work.currentVersionNumber}</span>
                        </div>
                        <h2 className="mt-3 truncate text-sm font-bold text-slate-900">{work.title}</h2>
                        <p className="mt-1 text-xs text-slate-600">{work.type === "report" ? "تقرير" : "ملف إنجاز"}</p>
                        <p className="mt-2 text-xs text-teal-800">{work.academicContext ? `${work.academicContext.yearLabel} · ${work.academicContext.termLabel || "السنة كاملة"}` : "دون سنة دراسية محددة"}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                      {work.ownerType === "personal" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                      {work.ownerType === "personal" ? "ملكية شخصية" : "ملكية مدرسية"}
                    </div>
                    <button type="button" onClick={() => setLocation(reportsOnly ? `/work/${work.id}/report` : `/work/${work.id}`)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900">
                      {reportsOnly ? "فتح التقرير" : "فتح العمل وإدارة الشواهد"} <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent
          showCloseButton={false}
          dir="rtl"
          className="z-[80] block max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("work-title")?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); createTrigger.current?.focus(); }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-950">{reportsOnly ? "إنشاء تقرير" : "إنشاء عمل"}</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-6 text-slate-600">
                {reportsOnly ? "أنشئ تقريرًا محفوظًا في مساحة العمل. يمكنك ربط الشواهد لاحقًا دون نسخها." : "اختر نوع العمل وملكيته. يمكن إضافة الشواهد لاحقًا دون نسخها."}
              </DialogDescription>
            </div>
            <button type="button" onClick={() => setShowCreate(false)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
          </div>

          <label htmlFor="work-title" className="mt-5 block text-xs font-bold text-slate-700">{reportsOnly ? "اسم التقرير" : "اسم العمل"}</label>
          <input
            id="work-title"
            aria-label={reportsOnly ? "اسم التقرير الجديد" : "اسم العمل الجديد"}
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={255}
            placeholder="مثال: تقرير برنامج الانضباط"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />

          {!reportsOnly && (
            <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="نوع العمل">
              <button type="button" aria-pressed={type === "report"} onClick={() => setType("report")} className={`min-h-11 rounded-xl border p-3 text-right ${type === "report" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><FileText className="mb-2 h-4 w-4 text-teal-700" /><span className="block text-xs font-bold text-slate-900">تقرير</span></button>
              <button type="button" aria-pressed={type === "portfolio"} onClick={() => setType("portfolio")} className={`min-h-11 rounded-xl border p-3 text-right ${type === "portfolio" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><FolderKanban className="mb-2 h-4 w-4 text-teal-700" /><span className="block text-xs font-bold text-slate-900">ملف إنجاز</span></button>
            </div>
          )}

          <p id="work-owner-label" className="mt-4 block text-xs font-bold text-slate-700">الملكية</p>
          <div role="group" aria-labelledby="work-owner-label" className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={ownerType === "personal"} onClick={() => selectOwnerType("personal")} className={`min-h-11 rounded-xl border p-3 text-right ${ownerType === "personal" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><UserRound className="mb-2 h-4 w-4" /><span className="block text-xs font-bold text-slate-900">شخصي</span></button>
            <button type="button" aria-pressed={ownerType === "organization"} onClick={() => selectOwnerType("organization")} disabled={organizations.length === 0} className={`min-h-11 rounded-xl border p-3 text-right disabled:cursor-not-allowed disabled:opacity-50 ${ownerType === "organization" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><Building2 className="mb-2 h-4 w-4" /><span className="block text-xs font-bold text-slate-900">مدرسي</span></button>
          </div>

          {ownerType === "organization" && (
            <select aria-label="مدرسة العمل" value={organizationId ?? ""} onChange={event => selectOrganization(Number(event.target.value) || undefined)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="">اختر المدرسة</option>
              {organizations.map(org => <option key={org.id} value={org.id}>{org.name} — {org.role}</option>)}
            </select>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">السنة الدراسية (اختياري)
              <select aria-label="سنة العمل" value={academicYearId ?? ""} onChange={event => { setAcademicYearId(Number(event.target.value) || undefined); setAcademicTermId(undefined); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal">
                <option value="">دون تحديد الآن</option>
                {scopeYears.map(year => <option key={year.id} value={year.id}>{year.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">الفصل الدراسي (اختياري)
              <select aria-label="فصل العمل" value={academicTermId ?? ""} disabled={!chosenYear} onChange={event => setAcademicTermId(Number(event.target.value) || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal disabled:opacity-50">
                <option value="">دون تحديد الآن</option>
                {chosenYear?.terms.map(term => <option key={term.id} value={term.id}>{term.label}</option>)}
              </select>
            </label>
          </div>

          {scopeYears.length === 0 && (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-6 text-slate-700">
              السنة والفصل اختياريان — يمكنك الإنشاء فورًا وربط العمل بسنة دراسية لاحقًا من صفحة الحساب.{" "}
              <a href="/account" className="font-bold text-teal-800 underline">إدارة السنوات الدراسية</a>
            </p>
          )}
          {yearsQuery.error && <p role="alert" className="mt-3 text-xs text-red-700">تعذر تحميل السنوات الدراسية. يمكنك المتابعة بإنشاء العمل دون تحديد سنة.</p>}

          {createWork.error && <p role="alert" className="mt-3 text-xs leading-6 text-red-700">{createWork.error.message}</p>}
          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowCreate(false)} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">إلغاء</button>
            <button type="button" onClick={submit} disabled={!canSubmit || createWork.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">{createWork.isPending && <Loader2 className="h-4 w-4 animate-spin" />}إنشاء</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
