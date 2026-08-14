export function buildAssistantQuickQuestions(criterionName?: string): string[] {
  const target = criterionName?.trim() || "هذا البند";
  return [
    `اقترح شاهداً مناسباً لـ ${target}`,
    "ما الملفات أو الصور المناسبة لإرفاقها؟",
    "حسّن صياغة شاهد الأداء الحالي.",
    "ما النواقص التي ينبغي استكمالها؟",
  ];
}
