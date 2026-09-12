import ProductWorkspacePage from "@/components/ProductWorkspacePage";

export default function WorkHub() {
  return <ProductWorkspacePage eyebrow="مساحة العمل" title="أعمالي" description="أنشئ التقارير وملفات الإنجاز وتابع حالتها ونسخها من مكان واحد." emptyTitle="لا توجد أعمال بعد" emptyDescription="ابدأ بتقرير أو ملف إنجاز. ستتمكن من إعادة استخدام الشواهد الموجودة بدل رفعها من جديد." primaryAction={{ label: "إنشاء عمل", path: "/reports" }} secondaryAction={{ label: "فتح ملف الإنجاز", path: "/portfolio" }} />;
}
