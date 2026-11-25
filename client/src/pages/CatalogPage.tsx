import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Database, Laptop, Search, SlidersHorizontal, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import {
  getServiceAvailability,
  getSectionEntryRoute,
  sections,
  USER_ROLES,
  type ServiceAvailability,
  type UserRole,
} from "@/lib/data";

const availabilityMeta: Record<ServiceAvailability, { label: string; description: string; className: string }> = {
  server: { label: "محفوظ في مساحة العمل", description: "السجل المرتبط بالحساب ومساحة العمل", className: "bg-blue-50 text-blue-700 border-blue-200" },
  partial: { label: "مرتبط جزئياً", description: "قدرات تفاعلية مع حدود معلنة أو حفظ محلي", className: "bg-amber-50 text-amber-700 border-amber-200" },
  local: { label: "محلي على جهازك", description: "تبقى البيانات في هذه الأداة/الجهاز ولا تُعد سجلاً خادمياً", className: "bg-slate-100 text-slate-700 border-slate-200" },
  catalog: { label: "كتالوج غير منشور", description: "العنصر محفوظ في الكتالوج فقط؛ لا يوجد شراء أو تنزيل منشور", className: "bg-pink-50 text-pink-700 border-pink-200" },
  planned: { label: "قيد الإعداد", description: "لا يوجد route تشغيلي مثبت لهذه الخدمة بعد", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const availabilityIcon: Record<ServiceAvailability, typeof Database> = {
  server: Database,
  partial: CheckCircle2,
  local: Laptop,
  catalog: BookOpen,
  planned: Clock3,
};

type AvailabilityFilter = "all" | ServiceAvailability;

export default function CatalogPage() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<UserRole>("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");

  const entries = useMemo(
    () => sections.flatMap((section) => section.services.map((service) => ({ section, service }))),
    [],
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return entries.filter(({ section, service }) => {
      const matchesQuery = !normalizedQuery || [service.title, service.description, section.title, ...(service.tags ?? [])]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const matchesRole = role === "all" || !service.roles || service.roles.includes("all") || service.roles.includes(role);
      const serviceAvailability = getServiceAvailability(section, service);
      return matchesQuery && matchesRole && (availability === "all" || serviceAvailability === availability);
    });
  }, [availability, entries, query, role]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">
      <header className="bg-gradient-to-l from-teal-800 via-teal-700 to-emerald-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <button type="button" onClick={() => navigate("/")} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
            <ArrowRight className="h-4 w-4" /> العودة للرئيسية
          </button>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Wrench className="h-7 w-7" /></div>
            <div>
              <h1 className="text-2xl font-black sm:text-3xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>مكتبة الأدوات والخدمات</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">استكشف الخدمات الموجودة في الكتالوج الحالي. كل بطاقة توضح هل تفتح أداة موجودة، أو تبقى محلية، أو هي عنصر كتالوج غير منشور.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm leading-6 text-teal-900">
          <p>هذه الصفحة تعيد استخدام بيانات الخدمات الحالية فقط. لا تنشئ سجلاً خادمياً جديداً، ولا تفعّل شراءً أو تكاملاً غير منشور.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-teal-200/60 pt-3 text-xs">
            <span className="font-bold text-teal-950">مسارات النواة السحابية النشطة:</span>
            <button type="button" onClick={() => navigate("/work")} className="min-h-9 rounded-lg border border-teal-300 bg-white px-3 py-1.5 font-bold text-teal-900 hover:bg-teal-100">أعمالي (التقارير وملفات الإنجاز)</button>
            <button type="button" onClick={() => navigate("/evidence")} className="min-h-9 rounded-lg border border-teal-300 bg-white px-3 py-1.5 font-bold text-teal-900 hover:bg-teal-100">الشواهد ومصفوفة المعايير</button>
            <button type="button" onClick={() => navigate("/self-evaluation")} className="min-h-9 rounded-lg border border-teal-300 bg-white px-3 py-1.5 font-bold text-teal-900 hover:bg-teal-100">التقويم الذاتي وخطة التحسين</button>
            <button type="button" onClick={() => navigate("/reviews")} className="min-h-9 rounded-lg border border-teal-300 bg-white px-3 py-1.5 font-bold text-teal-900 hover:bg-teal-100">المراجعات والاعتمادات</button>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="فلاتر الكتالوج">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <span className="sr-only">البحث في الأدوات</span>
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم الأداة أو القسم أو الوصف" className="w-full rounded-xl border border-slate-200 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="whitespace-nowrap">الدور</span>
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400">
                {USER_ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {(["all", "server", "partial", "local", "catalog", "planned"] as AvailabilityFilter[]).map((value) => (
              <button key={value} type="button" onClick={() => setAvailability(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${availability === value ? "border-teal-600 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"}`}>
                {value === "all" ? "كل الحالات" : availabilityMeta[value].label}
              </button>
            ))}
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
          <p>{filteredEntries.length} خدمة مطابقة من {entries.length}</p>
          {(query || role !== "all" || availability !== "all") && <button type="button" onClick={() => { setQuery(""); setRole("all"); setAvailability("all"); }} className="font-semibold text-teal-700 hover:underline">إزالة الفلاتر</button>}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-700">لا توجد خدمات مطابقة</p>
            <p className="mt-1 text-sm text-slate-500">جرّب كلمة أخرى أو أزل أحد الفلاتر.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEntries.map(({ section, service }) => {
              const status = getServiceAvailability(section, service);
              const meta = availabilityMeta[status];
              const Icon = availabilityIcon[status];
              const route = status !== "catalog" && status !== "planned" ? getSectionEntryRoute(section) : undefined;
              const interactive = Boolean(route && (service.mode === "interactive" || service.mode === "both"));
              return (
                <article key={service.id} className="flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <span className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: section.color }}>{section.title}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${meta.className}`} title={meta.description}><Icon className="h-3 w-3" />{meta.label}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>{service.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{service.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500">{service.price > 0 ? `${service.price} ر.س — ${meta.label}` : meta.label}</span>
                    {interactive ? (
                      <button type="button" onClick={() => navigate(route!)} className="min-h-11 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800">فتح الأداة</button>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">لا يوجد فتح منشور</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
