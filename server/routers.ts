import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  ai: router({
    // تصنيف شاهد تلقائياً - الميزة الرئيسية على نمط معياري
    classifyEvidence: publicProcedure
      .input(z.object({
        description: z.string().optional(),
        fileName: z.string().optional(),
        fileType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `أنت نظام تصنيف ذكي لشواهد الأداء الوظيفي للمعلمين وفق معايير وزارة التعليم السعودية 1447هـ.

المعايير الـ 11 هي:
1. أداء الواجبات الوظيفية (std-1)
2. التفاعل مع المجتمع المهني (std-2)
3. التفاعل مع أولياء الأمور (std-3)
4. التنويع في استراتيجيات التدريس (std-4)
5. تحسين نتائج المتعلمين (std-5)
6. إعداد وتنفيذ خطة التعلم (std-6)
7. توظيف تقنيات ووسائل التعلم المناسبة (std-7)
8. تهيئة البيئة التعليمية (std-8)
9. الإدارة الصفية (std-9)
10. تحليل نتائج المتعلمين وتشخيص مستوياتهم (std-10)
11. تنوع أساليب التقويم (std-11)

بناءً على المعلومات التالية عن الشاهد، حدد المعيار والمؤشر الأنسب:
${input.description ? `وصف الشاهد: ${input.description}` : ""}
${input.fileName ? `اسم الملف: ${input.fileName}` : ""}
${input.fileType ? `نوع الملف: ${input.fileType}` : ""}

أعطني الإجابة بصيغة JSON.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت نظام تصنيف ذكي للشواهد التعليمية. أجب بصيغة JSON فقط." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "evidence_classification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  standardId: { type: "string", description: "معرف المعيار مثل std-1" },
                  standardNumber: { type: "integer", description: "رقم المعيار من 1 إلى 11" },
                  standardName: { type: "string", description: "اسم المعيار" },
                  indicatorIndex: { type: "integer", description: "رقم المؤشر داخل المعيار (يبدأ من 1)" },
                  indicatorText: { type: "string", description: "نص المؤشر" },
                  confidence: { type: "number", description: "نسبة الثقة من 0 إلى 1" },
                  reasoning: { type: "string", description: "سبب التصنيف" },
                },
                required: ["standardId", "standardNumber", "standardName", "indicatorIndex", "indicatorText", "confidence", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content;
        const content = typeof raw === 'string' ? raw : '{}';
        try {
          const classification = JSON.parse(content);
          return { classification, success: true };
        } catch {
          return { classification: null, success: false };
        }
      }),

    suggestEvidence: publicProcedure
      .input(z.object({
        jobTitle: z.string(),
        criterionName: z.string(),
        subEvidenceName: z.string(),
        existingContent: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "أنت مساعد ذكاء اصطناعي متخصص في التعليم السعودي وتقييم الأداء الوظيفي. مهمتك مساعدة المعلمين والإداريين في كتابة شواهد أداء وظيفي احترافية. أجب دائماً باللغة العربية. قدم 3-5 اقتراحات عملية ومحددة. كل اقتراح في سطر يبدأ بـ •"
            },
            {
              role: "user",
              content: `الوظيفة: ${input.jobTitle}\nالبند: ${input.criterionName}\nالشاهد الفرعي: ${input.subEvidenceName}${input.existingContent ? `\nالمحتوى الحالي: ${input.existingContent}` : ""}\n\nاقترح شواهد أداء وظيفي مناسبة.`
            }
          ],
        });
        const raw = response.choices?.[0]?.message?.content;
        const content = typeof raw === 'string' ? raw : '';
        const suggestions = content.split("\n").map((s: string) => s.replace(/^[•\-\*\d\.]+\s*/, "").trim()).filter((s: string) => s.length > 5);
        return { suggestions, rawContent: content };
      }),

    fillFormFields: publicProcedure
      .input(z.object({
        jobTitle: z.string(),
        criterionName: z.string(),
        subEvidenceName: z.string(),
        formFields: z.array(z.object({ id: z.string(), label: z.string(), type: z.string() })),
      }))
      .mutation(async ({ input }) => {
        const fieldsDesc = input.formFields.map(f => `- ${f.label} (${f.type})`).join("\n");
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت مساعد متخصص في التعليم السعودي. املأ نماذج التقارير بمحتوى احترافي. أجب بصيغة JSON فقط." },
            { role: "user", content: `الوظيفة: ${input.jobTitle}\nالبند: ${input.criterionName}\nالشاهد: ${input.subEvidenceName}\n\nالحقول:\n${fieldsDesc}\n\nأعطني قيم مقترحة بصيغة JSON. المفاتيح: ${input.formFields.map(f => f.id).join(", ")}` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "form_fill",
              strict: true,
              schema: {
                type: "object",
                properties: Object.fromEntries(input.formFields.map(f => [f.id, { type: "string", description: f.label }])),
                required: input.formFields.map(f => f.id),
                additionalProperties: false,
              },
            },
          },
        });
        const raw2 = response.choices?.[0]?.message?.content;
        const content = typeof raw2 === 'string' ? raw2 : '{}';
        try { return { filledData: JSON.parse(content), success: true }; }
        catch { return { filledData: {}, success: false }; }
      }),

    improveText: publicProcedure
      .input(z.object({ text: z.string(), context: z.string().optional() }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت محرر نصوص تعليمية محترف. حسّن النص ليكون أكثر احترافية مع الحفاظ على المعنى. أجب بالنص المحسّن فقط." },
            { role: "user", content: `${input.context ? `السياق: ${input.context}\n` : ""}النص: ${input.text}` }
          ],
        });
        const c = response.choices?.[0]?.message?.content;
        return { improved: (typeof c === 'string' ? c : input.text).trim() };
      }),

    suggest: publicProcedure
      .input(z.object({ prompt: z.string(), context: z.string().optional() }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت مساعد ذكاء اصطناعي متخصص في التعليم السعودي. قدم إجابات مفيدة ومحددة باللغة العربية." },
            { role: "user", content: `${input.context ? `السياق: ${input.context}\n` : ""}${input.prompt}` }
          ],
        });
        const c = response.choices?.[0]?.message?.content;
        return { content: (typeof c === 'string' ? c : "").trim() };
      }),

    // تحليل فجوات الشواهد
    analyzeGaps: publicProcedure
      .input(z.object({
        coveredIndicators: z.array(z.string()),
        totalIndicators: z.number(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت مستشار تعليمي متخصص في الأداء الوظيفي. قدم توصيات عملية لسد الفجوات في ملف الإنجاز. أجب باللغة العربية." },
            { role: "user", content: `المعلم غطى ${input.coveredIndicators.length} مؤشر من أصل ${input.totalIndicators}.\n\nالمؤشرات المغطاة:\n${input.coveredIndicators.join("\n")}\n\nقدم 3-5 توصيات عملية لتحسين ملف الإنجاز وسد الفجوات.` }
          ],
        });
        const c = response.choices?.[0]?.message?.content;
        return { recommendations: (typeof c === 'string' ? c : "").trim() };
      }),
  }),
});

export type AppRouter = typeof appRouter;
