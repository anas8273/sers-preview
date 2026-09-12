import { useLocation } from "wouter";
import {
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  CheckSquare,
  FileText,
  Library,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";

type ActionCard = {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const quickActions: ActionCard[] = [
  {
    title: "إنشاء عمل",
    description: "ابدأ تقريرًا أو ملف إنجاز من مساحة عمل موحدة.",
    path: "/work",
    icon: BriefcaseBusiness,
    accent: "bg-teal-50 text-teal-700",
  },
  {
    title: "إضافة شاهد",
    description: "ارفع الأصل مرة واحدة ثم أعد استخدامه في أكثر من عمل.",
    path: "/evidence",
    icon: UploadCloud,
    accent: "bg-cyan-50 text-cyan-700",
  },
  {
    title: "المراجعات",
    description: "تابع التعليقات والاعتمادات المرتبطة بنسخ ثابتة.",
    path: "/reviews",
    icon: CheckSquare,
    accent: "bg-violet-50 text-violet-700",
  },
  {
    title: "القوالب والمتجر",
    description: "طبّق قالبًا على عملك دون نسخ المحتوى أو فقد بياناته.",
    path: "/store",
    icon: ShoppingBag,
    accent: "bg-amber-50 text-amber-700",
  },
];

const workflow = [
  { label: "شاهد أو أصل", icon: Library },
  { label: "عمل", icon: FileText },
  { label: "نسخة", icon: ShieldCheck },
  { label: "مراجعة", icon: CheckSquare },
  { label: "مخرج", icon: Sparkles },
];

export default function Home() {
  const [location, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />

      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <section className="relative overflow-hidden rounded-3xl border border-teal-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-teal-100/60 blur-3xl" />
            <div className="absolute -bottom-24 right-12 h-48 w-48 rounded-full bg-cyan-100/50 blur-3xl" />
            <div className="relative max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700">
                <Sparkles className="h-3.5 w-3.5" />
                مساحة السجلات التعليمية الذكية
              </div>
              <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                أنجز عملك من معلومة واحدة، دون تكرار الرفع والتنسيق.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                في SERS يصبح الشاهد أصلًا قابلًا لإعادة الاستخدام: اربطه بالتقرير أو ملف الإنجاز، راجع نسخة ثابتة، ثم أنشئ المخرج الذي تحتاجه دون إعادة بناء المحتوى من الصفر.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => navigate("/work")} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-teal-600/20 transition hover:bg-teal-700">
                  <Plus className="h-4 w-4" />
                  ابدأ عملاً
                </button>
                <button onClick={() => navigate("/evidence")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  <UploadCloud className="h-4 w-4" />
                  أضف شاهدًا
                </button>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-teal-700">ابدأ حسب النتيجة</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">ماذا تريد أن تنجز الآن؟</h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button key={action.path} onClick={() => navigate(action.path)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-right transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
                    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${action.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{action.title}</h3>
                    <p className="mt-2 min-h-12 text-xs leading-6 text-slate-500">{action.description}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-700">
                      فتح
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-teal-700">تابع من حيث توقفت</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">أعمالي الأخيرة</h2>
                </div>
                <button onClick={() => navigate("/work")} className="text-xs font-bold text-teal-700 hover:text-teal-800">عرض الكل</button>
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-300" />
                <h3 className="mt-3 text-sm font-bold text-slate-800">ستظهر أعمالك هنا</h3>
                <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">
                  عند ربط واجهة Work الجديدة بالبيانات ستظهر آخر التقارير وملفات الإنجاز وحالة كل نسخة هنا، بدل عرض قائمة خدمات عامة.
                </p>
                <button onClick={() => navigate("/work")} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-teal-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
                  فتح مساحة العمل
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-amber-700">يحتاج انتباهك</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">متابعة اليوم</h2>
                </div>
                <Bell className="h-5 w-5 text-slate-300" />
              </div>
              <div className="mt-5 space-y-3">
                <button onClick={() => navigate("/reviews")} className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 text-right transition hover:border-violet-200 hover:bg-violet-50/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><CheckSquare className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800">المراجعات</p>
                      <p className="mt-1 text-[11px] text-slate-500">الطلبات والقرارات ستظهر هنا.</p>
                    </div>
                    <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
                <button onClick={() => navigate("/notifications")} className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 text-right transition hover:border-teal-200 hover:bg-teal-50/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Bell className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800">الإشعارات</p>
                      <p className="mt-1 text-[11px] text-slate-500">أحداث قابلة للتصرف، دون ضوضاء.</p>
                    </div>
                    <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
              </div>
            </section>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold text-teal-700">منطق SERS</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">دورة واحدة مترابطة بدل أدوات منفصلة</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="relative rounded-xl bg-slate-50 p-4 text-center">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm ring-1 ring-slate-100"><Icon className="h-4 w-4" /></div>
                    <p className="mt-2 text-xs font-bold text-slate-700">{step.label}</p>
                    {index < workflow.length - 1 && <ArrowLeft className="absolute -left-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 sm:block" />}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
