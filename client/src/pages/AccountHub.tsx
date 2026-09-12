import ProductWorkspacePage from "@/components/ProductWorkspacePage";

export default function AccountHub() {
  return <ProductWorkspacePage eyebrow="الهوية والملكية" title="الحساب والمدرسة" description="إدارة ملفك الشخصي وعضويات المدارس والأدوار والملكية والصلاحيات من مكان واحد." emptyTitle="مساحة الحساب قيد التجهيز" emptyDescription="سيتم ربط العضويات والأدوار هنا بعد اكتمال نموذج Organization / Membership في النواة." primaryAction={{ label: "العودة إلى الرئيسية", path: "/" }} />;
}
