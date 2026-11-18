import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const paths = [...source.matchAll(/<Route\s+path=\{\s*["']([^"']+)["']\s*\}/g)]
  .map(match => match[1]).filter(path => path !== "/404");
if (!paths.length || new Set(paths).size !== paths.length || paths.some(path => !path.startsWith("/") || path.includes(" "))) {
  throw new Error("Route manifest does not match explicit application routes");
}
const titles = {
  "/": "الرئيسية", "/work": "أعمالي", "/work/:id": "تفاصيل العمل", "/work/:id/report": "محرر التقرير",
  "/evidence": "الشواهد", "/reviews": "المراجعات", "/notifications": "الإشعارات", "/account": "الحساب والمدرسة",
  "/reports": "التقارير والمراجعة", "/reports/legacy": "التقارير المحلية القديمة", "/output/:token": "المخرج المشترك",
  "/exam/:token": "تسليم اختبار", "/exams": "الاختبارات", "/audit-log": "سجل التدقيق", "/share/:token": "ملف مشترك",
};
const routes = paths.map(path => ({ path, ...(titles[path] ? { title: titles[path] } : {}) }));
writeFileSync(resolve(root, "client/public/manus-routes.json"), `${JSON.stringify({ routes }, null, 2)}\n`);
console.log(`Synchronized ${routes.length} application routes`);
