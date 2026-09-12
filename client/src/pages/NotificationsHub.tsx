import ProductWorkspacePage from "@/components/ProductWorkspacePage";

export default function NotificationsHub() {
  return <ProductWorkspacePage eyebrow="تنبيهات قابلة للتصرف" title="الإشعارات" description="المراجعات والمدفوعات وانتهاء الروابط والأحداث المهمة تظهر هنا مع الإجراء المطلوب." emptyTitle="لا توجد إشعارات جديدة" emptyDescription="ستظهر هنا الأحداث التي تحتاج منك إجراء، مع منع تكرار التنبيهات غير الضرورية." primaryAction={{ label: "عرض أعمالي", path: "/work" }} />;
}
