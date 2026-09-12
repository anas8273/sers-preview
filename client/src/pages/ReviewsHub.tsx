import ProductWorkspacePage from "@/components/ProductWorkspacePage";

export default function ReviewsHub() {
  return <ProductWorkspacePage eyebrow="المراجعات والاعتمادات" title="المراجعات" description="تابع ما أرسلته للمراجعة وما وصل إليك، مع تثبيت القرار والتعليق على نسخة محددة من العمل." emptyTitle="لا توجد مراجعات حالياً" emptyDescription="عند إرسال نسخة من عمل للمراجعة ستظهر هنا حالتها والتعليقات والقرار." primaryAction={{ label: "العودة إلى أعمالي", path: "/work" }} />;
}
