export type OfficialStandardPackId = "saudi-teacher-eval-7" | "saudi-teacher-standards-11";

export type OfficialStandardSeed = {
  packId: OfficialStandardPackId;
  packTitle: string;
  standardKey: string;
  version: string;
  title: string;
  weightPercent?: number;
  domainLabel: string;
};

export const OFFICIAL_SAUDI_STANDARD_SEEDS: readonly OfficialStandardSeed[] = [
  // 1. عناصر تقييم الأداء الوظيفي للمعلم السعودي المحدّثة (7 عناصر — مجموع الأوزان 100%)
  {
    packId: "saudi-teacher-eval-7",
    packTitle: "عناصر تقييم الأداء الوظيفي للمعلم (7 عناصر)",
    standardKey: "SA-EVAL7-01",
    version: "2026.1",
    title: "أداء الواجبات الوظيفية",
    weightPercent: 10,
    domainLabel: "الانضباط والمسؤولية المهنية",
  },
  {
    packId: "saudi-teacher-eval-7",
    packTitle: "عناصر تقييم الأداء الوظيفي للمعلم (7 عناصر)",
    standardKey: "SA-EVAL7-02",
    version: "2026.1",
    title: "التفاعل مع المجتمع المهني",
    weightPercent: 10,
    domainLabel: "مجتمعات التعلم المهنية وتبادل الخبرات",
  },
  {
    packId: "saudi-teacher-eval-7",
    packTitle: "عناصر تقييم الأداء الوظيفي للمعلم (7 عناصر)",
    standardKey: "SA-EVAL7-03",
    version: "2026.1",
    title: "التفاعل مع أولياء الأمور",
    weightPercent: 10,
    domainLabel: "الشراكة الأسرية والتواصل التربوي",
  },
  {
    packId: "saudi-teacher-eval-7",
    packTitle: "عناصر تقييم الأداء الوظيفي للمعلم (7 عناصر)",
    standardKey: "SA-EVAL7-04",
    version: "2026.1",
    title: "التنوع في استراتيجيات التدريس",
    weightPercent: 20,
    domainLabel: "الممارسة التدريسية الفاعلة",
  },
  {
    packId: "saudi-teacher-eval-7",
    packTitle: "عناصر تقييم الأداء الوظيفي للمعلم (7 عناصر)",
    standardKey: "SA-EVAL7-05",
    version: "2026.1",
    title: "تحسين نتائج المتعلمين",
    weightPercent: 20,
    domainLabel: "الفاقد التعليمي والإثراء وقياس الأثر",
  },
  {
    packId: "saudi-teacher-eval-7",
    packTitle: "عناصر تقييم الأداء الوظيفي للمعلم (7 عناصر)",
    standardKey: "SA-EVAL7-06",
    version: "2026.1",
    title: "إعداد وتنفيذ خطة التعلم",
    weightPercent: 10,
    domainLabel: "التخطيط وتوزيع المنهج والأهداف",
  },
  {
    packId: "saudi-teacher-eval-7",
    packTitle: "عناصر تقييم الأداء الوظيفي للمعلم (7 عناصر)",
    standardKey: "SA-EVAL7-07",
    version: "2026.1",
    title: "توظيف تقنيات ووسائل التعلم المناسبة",
    weightPercent: 20,
    domainLabel: "التعليم الرقمي والوسائل المساندة",
  },

  // 2. المعايير المهنية للمعلمين (11 معيارًا)
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-01",
    version: "2026.1",
    title: "الالتزام بالقيم الإسلامية الوسطية وأخلاقيات المهنة",
    domainLabel: "القيم والمسؤوليات المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-02",
    version: "2026.1",
    title: "التطوير المهني المستمر",
    domainLabel: "القيم والمسؤوليات المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-03",
    version: "2026.1",
    title: "التفاعل المهني مع التربويين والمجتمع",
    domainLabel: "القيم والمسؤوليات المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-04",
    version: "2026.1",
    title: "الإلمام بالمهارات اللغوية والكمية",
    domainLabel: "المعرفة المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-05",
    version: "2026.1",
    title: "معرفة المتعلم وكيفية تعلمه",
    domainLabel: "المعرفة المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-06",
    version: "2026.1",
    title: "معرفة محتوى التخصص وطرق تدريسه",
    domainLabel: "المعرفة المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-07",
    version: "2026.1",
    title: "التخطيط للتدريس وتنفيذه",
    domainLabel: "الممارسة المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-08",
    version: "2026.1",
    title: "تهيئة بيئات تعلم تفاعلية وداعمة للمتعلم",
    domainLabel: "الممارسة المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-09",
    version: "2026.1",
    title: "تقويم أداء المتعلمين وتوظيف نتائجه",
    domainLabel: "الممارسة المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-10",
    version: "2026.1",
    title: "دعم التعلم الشامل ومراعاة الفروق الفردية",
    domainLabel: "الممارسة المهنية",
  },
  {
    packId: "saudi-teacher-standards-11",
    packTitle: "المعايير المهنية للمعلمين (11 معيارًا)",
    standardKey: "SA-STD11-11",
    version: "2026.1",
    title: "المبادرات التربوية والقيادة المدرسية المساندة",
    domainLabel: "الممارسة المهنية",
  },
];

export type SmartEvidenceStandardRow = {
  standardVersionId: number;
  standardKey: string;
  version: string;
  title: string;
  packId: string | null;
  weightPercent: number | null;
  domainLabel: string | null;
  status: "verified" | "supporting" | "missing";
  linkedAssets: Array<{
    assetId: number;
    title: string;
    kind: string;
    isVerifiedFile: boolean;
    note: string | null;
  }>;
};

export type SmartEvidenceMatrixSummary = {
  totalStandards: number;
  coveredStandards: number;
  verifiedStandards: number;
  coveragePercent: number;
  weightedScorePercent: number | null;
  rows: SmartEvidenceStandardRow[];
};

export function buildSmartEvidenceCoverage(input: {
  standards: Array<{
    id: number;
    standardKey: string;
    version: string;
    title: string;
    data?: Record<string, unknown> | null;
  }>;
  assets: Array<{ id: number; title: string; kind: string }>;
  links: Array<{ assetId: number; standardVersionId: number; note: string | null }>;
}): SmartEvidenceMatrixSummary {
  const assetById = new Map(input.assets.map(asset => [asset.id, asset]));
  const seedByKey = new Map(OFFICIAL_SAUDI_STANDARD_SEEDS.map(seed => [seed.standardKey, seed]));
  const linksByStandard = new Map<number, Array<{ assetId: number; note: string | null }>>();

  for (const link of input.links) {
    if (!assetById.has(link.assetId)) continue;
    const list = linksByStandard.get(link.standardVersionId) ?? [];
    list.push({ assetId: link.assetId, note: link.note });
    linksByStandard.set(link.standardVersionId, list);
  }

  let coveredStandards = 0;
  let verifiedStandards = 0;
  let totalWeight = 0;
  let earnedWeight = 0;

  const rows: SmartEvidenceStandardRow[] = input.standards.map(std => {
    const seed = seedByKey.get(std.standardKey);
    const data = std.data && typeof std.data === "object" ? std.data : undefined;
    const packId = typeof data?.packId === "string" ? data.packId : seed?.packId ?? null;
    const weightPercent = typeof data?.weightPercent === "number" ? data.weightPercent : seed?.weightPercent ?? null;
    const domainLabel = typeof data?.domainLabel === "string" ? data.domainLabel : seed?.domainLabel ?? null;

    const rawLinks = linksByStandard.get(std.id) ?? [];
    const linkedAssets = rawLinks
      .map(link => {
        const asset = assetById.get(link.assetId);
        if (!asset) return null;
        return {
          assetId: asset.id,
          title: asset.title,
          kind: asset.kind,
          isVerifiedFile: asset.kind === "file",
          note: link.note,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const hasVerified = linkedAssets.some(item => item.isVerifiedFile);
    const status: SmartEvidenceStandardRow["status"] = hasVerified
      ? "verified"
      : linkedAssets.length > 0
        ? "supporting"
        : "missing";

    if (linkedAssets.length > 0) coveredStandards += 1;
    if (hasVerified) verifiedStandards += 1;
    if (typeof weightPercent === "number" && weightPercent > 0) {
      totalWeight += weightPercent;
      if (linkedAssets.length > 0) earnedWeight += weightPercent;
    }

    return {
      standardVersionId: std.id,
      standardKey: std.standardKey,
      version: std.version,
      title: std.title,
      packId,
      weightPercent,
      domainLabel,
      status,
      linkedAssets,
    };
  });

  const totalStandards = rows.length;
  const coveragePercent = totalStandards > 0 ? Math.round((coveredStandards / totalStandards) * 100) : 0;
  const weightedScorePercent = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : null;

  return {
    totalStandards,
    coveredStandards,
    verifiedStandards,
    coveragePercent,
    weightedScorePercent,
    rows,
  };
}
