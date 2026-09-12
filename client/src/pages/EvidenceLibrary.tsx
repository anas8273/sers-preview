import ProductWorkspacePage from "@/components/ProductWorkspacePage";

export default function EvidenceLibrary() {
  return <ProductWorkspacePage eyebrow="مكتبة قابلة لإعادة الاستخدام" title="الشواهد والأصول" description="ارفع الشاهد مرة واحدة، ثم اربطه بأكثر من تقرير أو ملف إنجاز دون تكرار النسخ." emptyTitle="مكتبة الشواهد فارغة" emptyDescription="أضف أول شاهد أو أصل. لاحقًا ستظهر هنا أماكن استخدامه وروابطه بالمعايير والأعمال." primaryAction={{ label: "إضافة شاهد", path: "/performance-evidence" }} />;
}
