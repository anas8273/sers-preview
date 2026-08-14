import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createHash, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  createPortfolio, updatePortfolio, getPortfoliosByUser, getPortfolioById, deletePortfolio,
  getAllPortfolios, reviewPortfolio,
  createUploadedFile, getFilesByPortfolio, deleteUploadedFile,
  createEvidenceComment, getEvidenceComments, deleteEvidenceComment,
  createOnlineExam, getOnlineExamByToken, getOnlineExamById, deactivateOnlineExam, createOnlineExamResponse, getOnlineExamResponses,
  createShareLink, getShareLinkByToken, incrementShareLinkViews, getShareLinksByPortfolio, deactivateShareLink,
  createPdfTemplate, updatePdfTemplate, deletePdfTemplate, getActivePdfTemplates, getAllPdfTemplates, seedDefaultTemplates,
  createUserTheme, updateUserTheme, deleteUserTheme, getUserThemes,
} from "./db";

const hashShareAccessCode = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const verifyShareAccessCode = (storedValue: string | null, suppliedValue: string | undefined) => {
  if (!storedValue || !suppliedValue) return false;
  const expected = /^[a-f0-9]{64}$/i.test(storedValue) ? storedValue : hashShareAccessCode(storedValue);
  const received = hashShareAccessCode(suppliedValue);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
};

async function assertCommentPortfolioAccess(user: { id: number; role: string }, portfolioId: number) {
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio || (portfolio.userId !== user.id && user.role !== "admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الوصول إلى تعليقات هذا الملف" });
  }
  return portfolio;
}

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

  // ─── Portfolio CRUD ────────────────────────────────────
  portfolio: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPortfoliosByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const p = await getPortfolioById(input.id);
        if (!p || p.userId !== ctx.user.id) return null;
        return p;
      }),

    create: protectedProcedure
      .input(z.object({
        jobId: z.string(),
        jobTitle: z.string(),
        personalInfo: z.record(z.string(), z.string()),
        criteriaData: z.record(z.string(), z.any()),
        customCriteria: z.array(z.any()).optional(),
        themeId: z.string().optional(),
        completionPercentage: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createPortfolio({
          userId: ctx.user.id,
          jobId: input.jobId,
          jobTitle: input.jobTitle,
          personalInfo: input.personalInfo as Record<string, string>,
          criteriaData: input.criteriaData,
          customCriteria: input.customCriteria ?? [],
          themeId: input.themeId ?? "classic",
          completionPercentage: input.completionPercentage ?? 0,
          status: "draft",
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        criteriaData: z.record(z.string(), z.any()).optional(),
        customCriteria: z.array(z.any()).optional(),
        personalInfo: z.record(z.string(), z.string()).optional(),
        themeId: z.string().optional(),
        completionPercentage: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return updatePortfolio(id, ctx.user.id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deletePortfolio(input.id, ctx.user.id);
      }),

    submit: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return updatePortfolio(input.id, ctx.user.id, { status: "submitted" });
    }),
  }),

  // ─── Collaborative Evidence Comments ─────────────────────
  evidenceComment: router({
    list: protectedProcedure
      .input(z.object({ portfolioId: z.number(), criterionId: z.string().min(1), evidenceId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertCommentPortfolioAccess(ctx.user, input.portfolioId);
        return getEvidenceComments(input.portfolioId, input.criterionId, input.evidenceId);
      }),

    create: protectedProcedure
      .input(z.object({
        portfolioId: z.number(),
        criterionId: z.string().min(1).max(128),
        evidenceId: z.string().min(1).max(128),
        content: z.string().trim().min(1, "اكتب تعليقاً قبل الإرسال").max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertCommentPortfolioAccess(ctx.user, input.portfolioId);
        return createEvidenceComment({
          portfolioId: input.portfolioId,
          criterionId: input.criterionId,
          evidenceId: input.evidenceId,
          userId: ctx.user.id,
          content: input.content,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteEvidenceComment(input.id, ctx.user.id, ctx.user.role === "admin");
    }),
  }),

  // ─── Online Exam Sharing ───────────────────────────────────
  onlineExam: router({
    create: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1).max(255),
        subject: z.string().trim().min(1).max(255),
        grade: z.string().trim().min(1).max(128),
        semester: z.string().trim().min(1).max(64),
        duration: z.string().trim().max(64),
        themeId: z.string().trim().min(1).max(64),
        fontFamily: z.string().trim().min(1).max(128),
        questions: z.array(z.record(z.string(), z.any())).min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const token = nanoid(24);
        return createOnlineExam({ ...input, userId: ctx.user.id, token });
      }),

    view: publicProcedure
      .input(z.object({ token: z.string().min(12).max(128) }))
      .query(async ({ input }) => {
        const exam = await getOnlineExamByToken(input.token);
        if (!exam) return null;
        const questions = (exam.questions as Array<Record<string, unknown>>).map(({ correctAnswer, correctIndex, ...question }) => question);
        return {
          title: exam.title,
          subject: exam.subject,
          grade: exam.grade,
          semester: exam.semester,
          duration: exam.duration,
          themeId: exam.themeId,
          fontFamily: exam.fontFamily,
          questions,
        };
      }),

    submit: publicProcedure
      .input(z.object({
        token: z.string().min(12).max(128),
        studentName: z.string().trim().min(2).max(255),
        studentId: z.string().trim().max(128).optional(),
        answers: z.record(z.string(), z.union([z.string(), z.number()])),
      }))
      .mutation(async ({ input }) => {
        const exam = await getOnlineExamByToken(input.token);
        if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "رابط الاختبار غير صالح أو تم إيقافه" });
        const questions = exam.questions as Array<Record<string, unknown>>;
        let autoScore = 0;
        let autoMaxScore = 0;
        let requiresManualReview = false;

        for (const question of questions) {
          const type = String(question.type || "");
          const id = String(question.id || "");
          const points = Number(question.points || 0);
          const answer = input.answers[id];
          if (type === "essay") {
            requiresManualReview = true;
            continue;
          }
          autoMaxScore += points;
          const normalizedAnswer = String(answer ?? "").trim().toLocaleLowerCase("ar-SA");
          const expected = type === "multiple-choice"
            ? String(question.correctIndex ?? "")
            : String(question.correctAnswer ?? "").trim().toLocaleLowerCase("ar-SA");
          if (normalizedAnswer && normalizedAnswer === expected) autoScore += points;
        }

        const response = await createOnlineExamResponse({
          onlineExamId: exam.id,
          studentName: input.studentName,
          studentId: input.studentId || null,
          answers: input.answers,
          autoScore,
          autoMaxScore,
        });
        return { ...response, autoScore, autoMaxScore, requiresManualReview };
      }),

    responses: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const exam = await getOnlineExamById(input.id);
        if (!exam || (exam.userId !== ctx.user.id && ctx.user.role !== "admin")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية مراجعة تسليمات هذا الاختبار" });
        }
        return getOnlineExamResponses(exam.id);
      }),

    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => deactivateOnlineExam(input.id, ctx.user.id)),
  }),

  // ─── File Upload ───────────────────────────────────────
  file: router({
    upload: protectedProcedure
      .input(z.object({
        portfolioId: z.number().optional(),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
        criterionId: z.string().optional(),
        subEvidenceId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const suffix = nanoid(8);
        const ext = input.fileName.split('.').pop() || 'bin';
        const fileKey = `evidence/${ctx.user.id}/${suffix}.${ext}`;
        const buffer = Buffer.from(input.base64Data, 'base64');
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        const { id } = await createUploadedFile({
          userId: ctx.user.id,
          portfolioId: input.portfolioId ?? null,
          fileKey,
          url,
          originalName: input.fileName,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          criterionId: input.criterionId ?? null,
          subEvidenceId: input.subEvidenceId ?? null,
        });

        return { id, url, fileKey };
      }),

    listByPortfolio: protectedProcedure
      .input(z.object({ portfolioId: z.number() }))
      .query(async ({ input }) => {
        return getFilesByPortfolio(input.portfolioId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteUploadedFile(input.id, ctx.user.id);
      }),
  }),

  // ─── Share Links ───────────────────────────────────────
  share: router({
    create: protectedProcedure
      .input(z.object({
        portfolioId: z.number(),
        expiresInDays: z.number().min(1).max(30).default(7),
        maxViews: z.number().min(0).max(1000).default(0),
        password: z.string().min(4).max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const token = nanoid(32);
        const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

        await createShareLink({
          portfolioId: input.portfolioId,
          userId: ctx.user.id,
          token,
          expiresAt,
          hasPassword: !!input.password,
          passwordHash: input.password ? hashShareAccessCode(input.password) : null,
          viewCount: 0,
          maxViews: input.maxViews,
          isActive: true,
        });

        return { token, expiresAt };
      }),

    view: publicProcedure
      .input(z.object({
        token: z.string(),
        password: z.string().max(64).optional(),
      }))
      .query(async ({ input }) => {
        const link = await getShareLinkByToken(input.token);
        if (!link) return { error: "رابط غير صالح", portfolio: null };
        if (new Date() > link.expiresAt) return { error: "انتهت صلاحية الرابط", portfolio: null };
        if ((link.maxViews ?? 0) > 0 && (link.viewCount ?? 0) >= (link.maxViews ?? 0)) return { error: "تم تجاوز الحد الأقصى للمشاهدات", portfolio: null };
        if (link.hasPassword && !verifyShareAccessCode(link.passwordHash, input.password)) return { error: "رمز الوصول غير صحيح", portfolio: null, requiresPassword: true };

        await incrementShareLinkViews(link.id);
        const portfolio = await getPortfolioById(link.portfolioId);
        if (!portfolio) return { error: "الملف غير موجود", portfolio: null };

        // إشعار المالك عند مشاهدة رابط المشاركة
        const newViewCount = (link.viewCount ?? 0) + 1;
        // إشعار عند أول مشاهدة وكل 5 مشاهدات
        if (newViewCount === 1 || newViewCount % 5 === 0) {
          notifyOwner({
            title: `مشاهدة رابط مشاركة - ${portfolio.jobTitle || 'ملف أداء'}`,
            content: `تمت مشاهدة رابط المشاركة لملف "${portfolio.jobTitle}" (المشاهدة رقم ${newViewCount}). الرابط: ${input.token.substring(0, 8)}...`,
          }).catch(() => {}); // لا نوقف العملية إذا فشل الإشعار
        }

        const files = await getFilesByPortfolio(portfolio.id);
        return { error: null, portfolio, files };
      }),

    listByPortfolio: protectedProcedure
      .input(z.object({ portfolioId: z.number() }))
      .query(async ({ input }) => {
        return getShareLinksByPortfolio(input.portfolioId);
      }),

    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deactivateShareLink(input.id, ctx.user.id);
      }),
  }),

  // ─── Admin Dashboard ──────────────────────────────────
  admin: router({
    portfolios: adminProcedure
      .input(z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getAllPortfolios(input.page, input.limit, input.status);
      }),

    review: adminProcedure
      .input(z.object({
        portfolioId: z.number(),
        status: z.enum(["approved", "rejected", "reviewed"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return reviewPortfolio(input.portfolioId, ctx.user.id, input.status, input.notes ?? "");
      }),

    portfolioDetail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const portfolio = await getPortfolioById(input.id);
        if (!portfolio) return null;
        const files = await getFilesByPortfolio(portfolio.id);
        return { ...portfolio, files };
      }),
  }),

  // ─── PDF Templates ──────────────────────────────────────────
  templates: router({
    list: publicProcedure.query(async () => {
      return getActivePdfTemplates();
    }),

    listAll: adminProcedure.query(async () => {
      return getAllPdfTemplates();
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        headerBg: z.string(),
        headerText: z.string(),
        accent: z.string(),
        borderColor: z.string(),
        bodyBg: z.string(),
        fontFamily: z.string().optional(),
        coverImageUrl: z.string().optional(),
        logoUrl: z.string().optional(),
        templateLayout: z.any().optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createPdfTemplate({ ...input, createdBy: ctx.user.id });
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        headerBg: z.string().optional(),
        headerText: z.string().optional(),
        accent: z.string().optional(),
        borderColor: z.string().optional(),
        bodyBg: z.string().optional(),
        fontFamily: z.string().optional(),
        coverImageUrl: z.string().optional(),
        logoUrl: z.string().optional(),
        templateLayout: z.any().optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updatePdfTemplate(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deletePdfTemplate(input.id);
      }),

    seed: adminProcedure.mutation(async () => {
      await seedDefaultTemplates();
      return { success: true };
    }),

    uploadImage: adminProcedure
      .input(z.object({
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
        imageType: z.enum(['cover', 'logo', 'background']),
      }))
      .mutation(async ({ ctx, input }) => {
        const suffix = nanoid(8);
        const ext = input.fileName.split('.').pop() || 'png';
        const fileKey = `templates/${input.imageType}/${suffix}.${ext}`;
        const buffer = Buffer.from(input.base64Data, 'base64');
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url, fileKey };
      }),

    // مشاركة القالب عبر رابط فريد
    generateShareLink: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const token = nanoid(24);
        await updatePdfTemplate(input.id, { shareToken: token, isShared: true } as any);
        return { token };
      }),

    revokeShareLink: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updatePdfTemplate(input.id, { shareToken: null, isShared: false } as any);
        return { success: true };
      }),

    getByShareToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const all = await getAllPdfTemplates();
        const template = all.find((t: any) => t.shareToken === input.token && t.isShared);
        if (!template) return null;
        return template;
      }),

    importFromShare: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const all = await getAllPdfTemplates();
        const source = all.find((t: any) => t.shareToken === input.token && t.isShared);
        if (!source) throw new Error('القالب غير موجود أو تم إلغاء المشاركة');
        // حفظ كثيم مخصص للمستخدم
        return createUserTheme({
          userId: ctx.user.id,
          name: `${source.name} (مستورد)`,
          description: source.description || '',
          themeData: {
            headerBg: source.headerBg,
            headerText: source.headerText,
            accent: source.accent,
            borderColor: source.borderColor,
            bodyBg: source.bodyBg,
            fontFamily: source.fontFamily,
            coverImageUrl: source.coverImageUrl,
            logoUrl: source.logoUrl,
            templateLayout: source.templateLayout,
          },
        });
      }),
  }),

  // ─── User Custom Themes ───────────────────────────────────────────────
  userThemes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserThemes(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        themeData: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ ctx, input }) => {
        return createUserTheme({
          userId: ctx.user.id,
          name: input.name,
          description: input.description ?? null,
          themeData: input.themeData,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        themeData: z.record(z.string(), z.any()).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return updateUserTheme(id, ctx.user.id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteUserTheme(input.id, ctx.user.id);
      }),
  }),

  // ─── AI Services ──────────────────────────────────────────────────────
  ai: router({
    classifyEvidence: publicProcedure
      .input(z.object({
        description: z.string().optional(),
        fileName: z.string().optional(),
        fileType: z.string().optional(),
        fileUrl: z.string().optional(),
        linkUrl: z.string().optional(),
        // بيانات الوظيفة والبنود الفعلية
        jobId: z.string().optional(),
        jobTitle: z.string().optional(),
        // البنود الفعلية للوظيفة المختارة (بدلاً من hardcode المعلم فقط)
        criteriaList: z.array(z.object({
          id: z.string(),
          title: z.string(),
          subEvidences: z.array(z.object({
            id: z.string(),
            title: z.string(),
            isCustom: z.boolean().optional(),
          })),
        })).optional(),
        // سجل التعلم: تصنيفات ناجحة سابقة لتحسين الدقة
        learningContext: z.array(z.object({
          fileName: z.string(),
          criterionId: z.string(),
          criterionTitle: z.string(),
          subEvidenceId: z.string(),
          subEvidenceTitle: z.string(),
        })).max(10).optional(),
      }))
      .mutation(async ({ input }) => {
        // بناء prompt ديناميكي حسب الوظيفة
        const jobTitle = input.jobTitle || 'معلم / معلمة';
        const hasDynamicCriteria = input.criteriaList && input.criteriaList.length > 0;
        
        // بناء قائمة البنود ديناميكياً من البيانات المرسلة
        let dynamicStandardsList = '';
        if (hasDynamicCriteria) {
          dynamicStandardsList = input.criteriaList!.map((c, i) => {
            let entry = `${i + 1}. ${c.title} (${c.id}):`;
            if (c.subEvidences.length > 0) {
              entry += '\n' + c.subEvidences.map((s, j) => {
                const customTag = s.isCustom ? ' [مخصص - أضافه المستخدم]' : '';
                return `   - البند ${j + 1} (indicatorIndex=${j + 1}): ${s.title}${customTag}`;
              }).join('\n');
            }
            return entry;
          }).join('\n\n');
        }
        
        // بناء سياق سجل التعلم
        let learningContextText = '';
        if (input.learningContext && input.learningContext.length > 0) {
          learningContextText = `\n\nسجل التصنيفات السابقة الناجحة (استخدمها كمرجع لتحسين دقة التصنيف):\n` +
            input.learningContext.map(l => 
              `- "${l.fileName}" → ${l.criterionTitle} → ${l.subEvidenceTitle}`
            ).join('\n');
        }

        const SYSTEM_PROMPT = `أنت نظام تصنيف ذكي متقدم لشواهد الأداء الوظيفي وفق معايير وزارة التعليم السعودية 1447هـ.
الوظيفة الحالية: ${jobTitle}

مهمتك:
1. حلل المحتوى بعمق (صورة، ملف، رابط، نص، فيديو) واستخرج المعلومات الرئيسية
2. حدد المعيار/البند الأنسب من البنود المتاحة (المستوى الأول) - استخدم standardId الموضح بين الأقواس
3. حدد البند الفرعي الأنسب داخل المعيار (المستوى الثاني) - استخدم رقم البند indicatorIndex
4. حدد البند الفرعي الأنسب داخل البند (المستوى الثالث) - استخدم رقم الفرعي subIndicatorIndex

قواعد مهمة جداً:
- استخدم standardId الموضح بين الأقواس بالضبط
- indicatorIndex يبدأ من 1 ويمثل رقم البند داخل المعيار
- subIndicatorIndex يبدأ من 1 ويمثل رقم البند الفرعي. إذا لم تستطع تحديد الفرعي بدقة، ضع 0
- إذا كان subIndicatorIndex = 0، سيتم إدراج الشاهد تحت البند الرئيسي مباشرة (وهذا سلوك صحيح)
- indicatorText يجب أن يكون النص الفعلي للبند كما هو موضح أدناه
- عند تحليل الفيديو: حلل اسم الملف ونوعه لتحديد السياق التعليمي
- البنود المعلمة بـ [مخصص] هي بنود فرعية أضافها المستخدم - اعطها أولوية إذا كان المحتوى مناسباً لها
${learningContextText}

البنود المتاحة لوظيفة "${jobTitle}":

${hasDynamicCriteria ? dynamicStandardsList : `لم يتم تزويد بنود محددة - استخدم المعايير الافتراضية للمعلم`}

عند تحليل الصور:
- اقرأ أي نص عربي أو إنجليزي ظاهر في الصورة
- حدد نوع الوثيقة (شهادة، تقرير، خطاب، صورة نشاط، لقطة شاشة)
- حلل السياق التعليمي للصورة
- استخرج المعلومات الرئيسية (التاريخ، الجهة، الموضوع)

عند تحليل الفيديو:
- حلل اسم الملف ونوعه لتحديد السياق التعليمي
- الفيديو قد يكون: درس تطبيقي، نشاط صفي، ورشة عمل، إذاعة صباحية، تكريم، مسابقة
- إذا كان اسم الملف يحتوي على كلمات دالة (مثل: درس، تطبيقي، نشاط، إذاعة) استخدمها للتصنيف

عند تحليل الروابط:
- حلل اسم النطاق والمسار لتحديد نوع المحتوى
- إذا كان رابط منصة تعليمية (مدرستي، عين، نور) صنفه حسب السياق

أجب بصيغة JSON فقط.`;

        const messages: any[] = [
          { role: "system", content: SYSTEM_PROMPT },
        ];

        // بناء قائمة مختصرة للبنود لرسائل المستخدم
        const STANDARDS_LIST = hasDynamicCriteria 
          ? input.criteriaList!.map((c, i) => `${i + 1}. ${c.title} (${c.id})`).join('\n')
          : `1. أداء الواجبات الوظيفية (std-1)
2. التفاعل مع المجتمع المهني (std-2)
3. التفاعل مع أولياء الأمور (std-3)
4. التنويع في استراتيجيات التدريس (std-4)
5. تحسين نتائج المتعلمين (std-5)
6. إعداد وتنفيذ خطة التعلم (std-6)
7. توظيف تقنيات ووسائل التعلم المناسبة (std-7)
8. تهيئة البيئة التعليمية (std-8)
9. الإدارة الصفية (std-9)
10. تحليل نتائج المتعلمين وتشخيص مستوياتهم (std-10)
11. تنوع أساليب التقويم (std-11)`;

        // تحليل بصري للصور والفيديوهات (الفيديو يُرسل كإطار مستخرج)
        if (input.fileUrl && (input.fileType?.startsWith('image/') || input.fileType?.startsWith('video/') || input.fileUrl.startsWith('data:image'))) {
          messages.push({
            role: "user",
            content: [
              { type: "image_url", image_url: { url: input.fileUrl, detail: "high" } },
              { type: "text", text: `حلل هذه ${input.fileType?.startsWith('video/') ? 'الصورة المستخرجة من مقطع فيديو' : 'الصورة'} بعمق وصنفها ضمن أحد المعايير:\n${STANDARDS_LIST}\n\nتعليمات التحليل:\n- اقرأ كل النصوص الظاهرة في الصورة (عربي/إنجليزي)\n- حدد نوع الوثيقة (شهادة، تقرير، خطاب، صورة نشاط، لقطة شاشة، مقطع فيديو)\n- حلل السياق التعليمي\n- استخرج التاريخ والجهة والموضوع إن وجد\n${input.description ? `وصف إضافي: ${input.description}` : ""}\n${input.fileName ? `اسم الملف: ${input.fileName}` : ""}` },
            ],
          });
        }
        // تحليل الروابط
        else if (input.linkUrl) {
          messages.push({
            role: "user",
            content: `حلل هذا الرابط وصنفه ضمن أحد المعايير:\n${STANDARDS_LIST}\n\nالرابط: ${input.linkUrl}\n${input.description ? `وصف: ${input.description}` : ""}\n\nتعليمات:\n- حلل اسم النطاق والمسار لتحديد نوع المحتوى\n- إذا كان رابط منصة تعليمية (مدرستي، عين، نور، كلاسيرا) صنفه حسب السياق\n- إذا كان رابط دورة تدريبية صنفه ضمن التطوير المهني`,
          });
        }
        // تحليل الفيديو بدون إطار (اعتماد على اسم الملف والوصف)
        else if (input.fileType?.startsWith('video/')) {
          messages.push({
            role: "user",
            content: `صنف هذا الشاهد (مقطع فيديو) ضمن أحد المعايير:\n${STANDARDS_LIST}\n\nنوع المحتوى: مقطع فيديو تعليمي\nاسم الملف: ${input.fileName || 'غير محدد'}\n${input.description ? `وصف: ${input.description}` : ''}\n\nتعليمات خاصة بالفيديو:\n- حلل اسم الملف بعناية لاستخراج السياق التعليمي\n- الفيديو قد يكون: درس تطبيقي، نشاط صفي، ورشة عمل، إذاعة صباحية، تكريم، مسابقة، إنتاج معرفي\n- استخدم الكلمات الدالة في اسم الملف لتحديد البند المناسب`,
          });
        }
        // تحليل الملفات بناءً على الاسم والنوع
        else {
          messages.push({
            role: "user",
            content: `صنف هذا الشاهد ضمن أحد المعايير:\n${STANDARDS_LIST}\n\n${input.description ? `وصف: ${input.description}` : ""}\n${input.fileName ? `اسم الملف: ${input.fileName}` : ""}\n${input.fileType ? `نوع الملف: ${input.fileType}` : ""}`,
          });
        }

        const response = await invokeLLM({
          messages,
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
                  indicatorIndex: { type: "integer", description: "رقم البند داخل المعيار (يبدأ من 1)" },
                  indicatorText: { type: "string", description: "نص البند" },
                  subIndicatorIndex: { type: "integer", description: "رقم البند الفرعي داخل البند (يبدأ من 1، 0 إذا لم يتحدد)" },
                  subIndicatorText: { type: "string", description: "نص البند الفرعي" },
                  confidence: { type: "number", description: "نسبة الثقة من 0 إلى 1" },
                  reasoning: { type: "string", description: "سبب التصنيف" },
                  contentDescription: { type: "string", description: "وصف محتوى الملف أو الصورة" },
                  suggestedPriority: { type: "string", description: "الأولوية المقترحة: essential أو supporting أو supplementary" },
                  suggestedKeywords: { type: "array", items: { type: "string" }, description: "كلمات مفتاحية مقترحة (3-5 كلمات)" },
                },
                required: ["standardId", "standardNumber", "standardName", "indicatorIndex", "indicatorText", "subIndicatorIndex", "subIndicatorText", "confidence", "reasoning", "contentDescription", "suggestedPriority", "suggestedKeywords"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content;
        const content = typeof raw === 'string' ? raw : '{}';
        try {
          return { classification: JSON.parse(content), success: true };
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
            { role: "system", content: "أنت مساعد ذكاء اصطناعي متخصص في التعليم السعودي وتقييم الأداء الوظيفي. مهمتك مساعدة المعلمين والإداريين في كتابة شواهد أداء وظيفي احترافية. أجب دائماً باللغة العربية. قدم 3-5 اقتراحات عملية ومحددة. كل اقتراح في سطر يبدأ بـ •" },
            { role: "user", content: `الوظيفة: ${input.jobTitle}\nالبند: ${input.criterionName}\nالشاهد الفرعي: ${input.subEvidenceName}${input.existingContent ? `\nالمحتوى الحالي: ${input.existingContent}` : ""}\n\nاقترح شواهد أداء وظيفي مناسبة.` }
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

  // ─── General AI Services (Reports, Radio, CV, Exams) ────────────────
  genAI: router({
    // تعبئة نموذج تقرير بالذكاء الاصطناعي
    fillReport: publicProcedure
      .input(z.object({
        templateName: z.string(),
        fields: z.array(z.object({ id: z.string(), label: z.string(), type: z.string() })),
        context: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const fieldsDesc = input.fields.map(f => `- ${f.label} (${f.type})`).join("\n");
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت مساعد تعليمي متخصص في كتابة التقارير والنماذج التعليمية السعودية. أنشئ محتوى احترافي ومفصل باللغة العربية. أجب بصيغة JSON فقط." },
            { role: "user", content: `نوع النموذج: ${input.templateName}\n${input.context ? `سياق إضافي: ${input.context}\n` : ""}\nالحقول المطلوبة:\n${fieldsDesc}\n\nأعطني قيم مقترحة احترافية بصيغة JSON. المفاتيح: ${input.fields.map(f => f.id).join(", ")}` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "report_fill",
              strict: true,
              schema: {
                type: "object",
                properties: Object.fromEntries(input.fields.map(f => [f.id, { type: "string", description: f.label }])),
                required: input.fields.map(f => f.id),
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content;
        const content = typeof raw === 'string' ? raw : '{}';
        try { return { filledData: JSON.parse(content), success: true }; }
        catch { return { filledData: {}, success: false }; }
      }),

    // توليد إذاعة مدرسية كاملة
    generateRadio: publicProcedure
      .input(z.object({
        theme: z.string(),
        segments: z.array(z.string()),
        additionalNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const segmentsList = input.segments.map((s, i) => `${i + 1}. ${s}`).join("\n");
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنت كاتب إذاعة مدرسية محترف. أنشئ محتوى إذاعة مدرسية كاملة ومتكاملة باللغة العربية الفصحى. لكل فقرة اكتب محتوى غني ومفيد (3-5 أسطر على الأقل). تأكد أن المحتوى تربوي ومناسب للبيئة المدرسية. أجب بصيغة JSON فقط.` },
            { role: "user", content: `موضوع الإذاعة: ${input.theme}\n${input.additionalNotes ? `ملاحظات: ${input.additionalNotes}\n` : ""}\nالفقرات المطلوبة:\n${segmentsList}\n\nأنشئ محتوى كامل لكل فقرة. أجب بصيغة JSON مع مفتاح "segments" يحتوي مصفوفة من الكائنات بالشكل: {"title": "عنوان الفقرة", "content": "محتوى الفقرة الكامل"}` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "radio_content",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  segments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "عنوان الفقرة" },
                        content: { type: "string", description: "محتوى الفقرة الكامل" },
                      },
                      required: ["title", "content"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["segments"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content;
        const content = typeof raw === 'string' ? raw : '{"segments":[]}';
        try { return { ...JSON.parse(content), success: true }; }
        catch { return { segments: [], success: false }; }
      }),

    // توليد سيرة ذاتية بالذكاء الاصطناعي
    generateCV: publicProcedure
      .input(z.object({
        name: z.string(),
        jobTitle: z.string(),
        experience: z.string().optional(),
        education: z.string().optional(),
        skills: z.string().optional(),
        additionalInfo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنت كاتب سير ذاتية محترف متخصص في المجال التعليمي السعودي. أنشئ سيرة ذاتية احترافية ومفصلة باللغة العربية. أجب بصيغة JSON فقط.` },
            { role: "user", content: `الاسم: ${input.name}\nالمسمى الوظيفي: ${input.jobTitle}\n${input.experience ? `الخبرات: ${input.experience}\n` : ""}${input.education ? `التعليم: ${input.education}\n` : ""}${input.skills ? `المهارات: ${input.skills}\n` : ""}${input.additionalInfo ? `معلومات إضافية: ${input.additionalInfo}\n` : ""}\nأنشئ سيرة ذاتية احترافية تشمل: ملخص مهني، خبرات عمل مفصلة، تعليم، مهارات، دورات تدريبية، إنجازات. أجب بصيغة JSON.` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "cv_data",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "ملخص مهني" },
                  experience: { type: "array", items: { type: "object", properties: { title: { type: "string" }, organization: { type: "string" }, period: { type: "string" }, description: { type: "string" } }, required: ["title", "organization", "period", "description"], additionalProperties: false } },
                  education: { type: "array", items: { type: "object", properties: { title: { type: "string" }, organization: { type: "string" }, period: { type: "string" }, description: { type: "string" } }, required: ["title", "organization", "period", "description"], additionalProperties: false } },
                  skills: { type: "array", items: { type: "string" } },
                  courses: { type: "array", items: { type: "object", properties: { title: { type: "string" }, organization: { type: "string" }, period: { type: "string" }, description: { type: "string" } }, required: ["title", "organization", "period", "description"], additionalProperties: false } },
                  achievements: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "experience", "education", "skills", "courses", "achievements"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content;
        const content = typeof raw === 'string' ? raw : '{}';
        try { return { cvData: JSON.parse(content), success: true }; }
        catch { return { cvData: null, success: false }; }
      }),

    // توليد أسئلة اختبار بالذكاء الاصطناعي
    generateExamQuestions: publicProcedure
      .input(z.object({
        subject: z.string(),
        grade: z.string(),
        topic: z.string().optional(),
        questionTypes: z.array(z.string()),
        count: z.number().min(1).max(30),
        difficulty: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنت معلم خبير في إعداد الاختبارات وفق المنهج السعودي. أنشئ أسئلة اختبار متنوعة ودقيقة باللغة العربية. تأكد من صحة الإجابات. أجب بصيغة JSON فقط.` },
            { role: "user", content: `المادة: ${input.subject}\nالصف: ${input.grade}\n${input.topic ? `الموضوع: ${input.topic}\n` : ""}أنواع الأسئلة: ${input.questionTypes.join(", ")}\nعدد الأسئلة: ${input.count}\n${input.difficulty ? `مستوى الصعوبة: ${input.difficulty}\n` : ""}\nأنشئ ${input.count} سؤال متنوع. لكل سؤال اختيار من متعدد أضف 4 خيارات مع تحديد الإجابة الصحيحة. لأسئلة صح/خطأ حدد الإجابة. للمقالي اكتب نموذج إجابة.` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "exam_questions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", description: "نوع السؤال: multiple-choice, true-false, essay, fill-blank" },
                        text: { type: "string", description: "نص السؤال" },
                        options: { type: "array", items: { type: "string" }, description: "الخيارات (للاختيار من متعدد)" },
                        correctAnswer: { type: "string", description: "الإجابة الصحيحة" },
                        points: { type: "integer", description: "عدد الدرجات" },
                        explanation: { type: "string", description: "شرح الإجابة" },
                      },
                      required: ["type", "text", "options", "correctAnswer", "points", "explanation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices?.[0]?.message?.content;
        const content = typeof raw === 'string' ? raw : '{"questions":[]}';
        try { return { ...JSON.parse(content), success: true }; }
        catch { return { questions: [], success: false }; }
      }),

    // توليد محتوى ملف إنجاز بالذكاء الاصطناعي
    generatePortfolioContent: publicProcedure
      .input(z.object({
        section: z.string(),
        jobTitle: z.string(),
        existingData: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت مساعد تعليمي متخصص في إنشاء ملفات الإنجاز المهنية للمعلمين والإداريين السعوديين. أنشئ محتوى احترافي ومفصل باللغة العربية." },
            { role: "user", content: `القسم: ${input.section}\nالوظيفة: ${input.jobTitle}\n${input.existingData ? `البيانات الحالية: ${input.existingData}\n` : ""}\nأنشئ محتوى احترافي لهذا القسم من ملف الإنجاز.` }
          ],
        });
        const c = response.choices?.[0]?.message?.content;
        return { content: (typeof c === 'string' ? c : "").trim() };
      }),
  }),
});

export type AppRouter = typeof appRouter;
