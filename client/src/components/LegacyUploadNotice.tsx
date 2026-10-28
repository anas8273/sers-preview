export const LEGACY_UPLOAD_MESSAGE = "الرفع من هذا المحرر متوقف. استخدم مكتبة الشواهد للرفع والفحص؛ لم يُضف الملف إلى هذا المحرر.";
export const LEGACY_TEMPLATE_UPLOAD_MESSAGE = "رفع صور القوالب من المسار القديم متوقف إلى حين ربطه بمسار فحص آمن. يمكنك متابعة تعديل النص والتنسيق والصور الموجودة.";

export function legacyUploadFailureMessage(error: unknown): string {
  const code = error && typeof error === "object" && "data" in error
    ? (error as { data?: { code?: string } }).data?.code : undefined;
  return code === "PRECONDITION_FAILED" ? LEGACY_UPLOAD_MESSAGE : "تعذر رفع المرفق؛ لم يُضف رابط جديد. يمكنك استخدام مكتبة الشواهد للرفع والفحص.";
}

export function LegacyUploadNotice({ template = false }: { template?: boolean }) {
  return <aside className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
    <p>{template ? LEGACY_TEMPLATE_UPLOAD_MESSAGE : "لرفع ملفات جديدة وفحصها استخدم مكتبة الشواهد. المرفقات المحلية هنا لا تمنح رابط مشاركة، والمكتبة لا تُدرج ملفاتها تلقائيًا في المحرر القديم."}</p>
    {!template && <a href="/evidence" className="mt-1 inline-block font-medium underline underline-offset-4">فتح مكتبة الشواهد للرفع</a>}
  </aside>;
}
