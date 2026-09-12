export type ProductNavItem = {
  label: string;
  path: string;
  icon: "home" | "work" | "evidence" | "reviews" | "store" | "notifications" | "account";
  description: string;
};

export const PRODUCT_NAV_ITEMS: ProductNavItem[] = [
  { label: "الرئيسية", path: "/", icon: "home", description: "تابع عملك والخطوة التالية" },
  { label: "أعمالي", path: "/work", icon: "work", description: "التقارير وملفات الإنجاز في مكان واحد" },
  { label: "الشواهد والأصول", path: "/evidence", icon: "evidence", description: "ارفع مرة واستخدم في أكثر من عمل" },
  { label: "المراجعات", path: "/reviews", icon: "reviews", description: "طلبات المراجعة والقرارات على نسخ ثابتة" },
  { label: "المتجر", path: "/store", icon: "store", description: "قوالب وحزم قابلة للتطبيق على أعمالك" },
  { label: "الإشعارات", path: "/notifications", icon: "notifications", description: "الأحداث التي تحتاج إجراء منك" },
  { label: "الحساب والمدرسة", path: "/account", icon: "account", description: "الملكية والعضويات والصلاحيات" },
];

export const LEGACY_TOOLS_ENABLED = import.meta.env.VITE_ENABLE_LEGACY_TOOLS === "true";

export function isProductRouteActive(currentPath: string, itemPath: string) {
  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}
