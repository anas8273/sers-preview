/** Do not surface provider errors or erase the user's manual draft. */
export function aiFailureMessage(error: unknown): string {
  const code = error && typeof error === "object" && "data" in error
    ? (error as { data?: { code?: string } }).data?.code : undefined;
  if (code === "UNAUTHORIZED") return "سجّل الدخول لاستخدام المساعدة الذكية. يمكنك متابعة الإدخال اليدوي؛ بياناتك لم تتغير.";
  if (code === "PRECONDITION_FAILED" || code === "FORBIDDEN") return "المساعدة الذكية غير متاحة لهذا الطلب. يمكنك متابعة الإدخال اليدوي؛ بياناتك لم تتغير.";
  if (code === "TOO_MANY_REQUESTS") return "وصلت طلبات المساعدة الذكية إلى الحد المتاح. حاول لاحقًا أو أكمل يدويًا؛ بياناتك لم تتغير.";
  if (code === "BAD_REQUEST") return "تعذر قبول طلب المساعدة الذكية. راجع حجم المحتوى ونوع الملف، أو أكمل يدويًا؛ بياناتك لم تتغير.";
  return "تعذرت المساعدة الذكية الآن. أعد المحاولة لاحقًا أو أكمل يدويًا؛ بياناتك لم تتغير.";
}
