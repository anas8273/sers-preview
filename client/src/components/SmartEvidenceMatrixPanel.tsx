import { useEffect, useState } from "react";
import { Award, Building2, CheckCircle2, CircleDashed, Loader2, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { OfficialStandardPackId } from "@shared/saudi-standards-packs";

type AssetOption = {
  id: number;
  title: string;
  kind: string;
  ownerType?: "personal" | "organization";
  ownerOrganizationId?: number | null;
};

export default function SmartEvidenceMatrixPanel({ assets }: { assets: AssetOption[] }) {
  const [packId, setPackId] = useState<OfficialStandardPackId>("saudi-teacher-eval-7");
  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>();
  const [selectedAssetByStandard, setSelectedAssetByStandard] = useState<Record<number, number | undefined>>({});

  const utils = trpc.useUtils();
  const orgsQuery = trpc.domain.organization.listMine.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (!selectedOrgId && orgsQuery.data && orgsQuery.data.length > 0) {
      setSelectedOrgId(orgsQuery.data[0]!.id);
    }
  }, [orgsQuery.data, selectedOrgId]);

  const activeSchoolId =
    packId === "etec-school-accreditation-10" && (orgsQuery.data?.length ?? 0) > 0
      ? (selectedOrgId ?? orgsQuery.data?.[0]?.id)
      : undefined;

  const matrixQuery = trpc.domain.standards.coverageMatrix.useQuery(
    activeSchoolId ? { packId, organizationId: activeSchoolId } : { packId },
    { retry: false },
  );

  const seedMutation = trpc.domain.standards.seedOfficialPacks.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.domain.standards.list.invalidate(),
        utils.domain.standards.coverageMatrix.invalidate(),
      ]);
    },
  });

  const linkMutation = trpc.domain.standards.linkAsset.useMutation({
    onSuccess: async (_res, vars) => {
      setSelectedAssetByStandard(current => ({ ...current, [vars.standardVersionId]: undefined }));
      await Promise.all([
        utils.domain.standards.coverageMatrix.invalidate(),
        utils.domain.standards.listForAsset.invalidate({ assetId: vars.assetId }),
      ]);
    },
  });

  const data = matrixQuery.data;
  const rows = data?.rows ?? [];

  return (
    <section className="mt-6 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6" aria-label="مصفوفة SmartEvidence لتغطية المعايير">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700">
            <Award className="h-4 w-4" /> مصفوفة التغطية الذكية (SmartEvidence)
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">تغطية عناصر التقييم والمعايير المهنية والمدرسية</h2>
          <p className="mt-1 text-xs leading-6 text-slate-600">
            تابع أي عنصر تقييم مكتمل بشاهد أصلي وأي عنصر ينقصه توثيق، واربط شواهدك مباشرة دون تكرار رفع الملفات.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="إطار المعايير">
          <button
            type="button"
            aria-pressed={packId === "saudi-teacher-eval-7"}
            onClick={() => setPackId("saudi-teacher-eval-7")}
            className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-bold transition ${packId === "saudi-teacher-eval-7" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`}
          >
            العناصر الـ 7 المحدّثة (100%)
          </button>
          <button
            type="button"
            aria-pressed={packId === "saudi-teacher-standards-11"}
            onClick={() => setPackId("saudi-teacher-standards-11")}
            className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-bold transition ${packId === "saudi-teacher-standards-11" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`}
          >
            المعايير المهنية الـ 11
          </button>
          <button
            type="button"
            aria-pressed={packId === "etec-school-accreditation-10"}
            onClick={() => setPackId("etec-school-accreditation-10")}
            className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-bold transition ${packId === "etec-school-accreditation-10" ? "bg-teal-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`}
          >
            معايير الاعتماد المدرسي الـ 10 (ETEC)
          </button>
        </div>
      </div>

      {packId === "etec-school-accreditation-10" && orgsQuery.data && orgsQuery.data.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3.5 py-2.5 text-xs text-teal-950">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <Building2 className="h-4 w-4 text-teal-700" />
            نطاق شواهد الاعتماد المدرسي:
          </span>
          {orgsQuery.data.length > 1 ? (
            <select
              aria-label="اختيار مدرسة الاعتماد المدرسي"
              value={activeSchoolId ?? ""}
              onChange={e => setSelectedOrgId(Number(e.target.value) || undefined)}
              className="min-w-0 max-w-full truncate rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900"
            >
              {orgsQuery.data.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-bold">{orgsQuery.data[0]!.name}</span>
          )}
        </div>
      )}

      {matrixQuery.isLoading && (
        <div role="status" className="mt-5 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-8 text-xs text-slate-600">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جارٍ حساب مصفوفة التغطية...
        </div>
      )}

      {matrixQuery.error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
          {matrixQuery.error.message}
        </p>
      )}

      {!matrixQuery.isLoading && !matrixQuery.error && rows.length === 0 && (
        <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-dashed border-teal-200 bg-teal-50/50 p-5 text-center sm:flex-row sm:text-right">
          <div>
            <p className="text-sm font-bold text-slate-900">حزمة المعايير الرسمية غير مفعّلة بعد في السجل</p>
            <p className="mt-1 text-xs text-slate-600">فعّل حزم عناصر تقييم الأداء الـ 7 والمعايير المهنية الـ 11 ومعايير الاعتماد المدرسي الـ 10 بنقرة واحدة لبدء ربط شواهدك بها.</p>
          </div>
          <button
            type="button"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate({ packId: "all" })}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            تفعيل حزمة المعايير الرسمية
          </button>
        </div>
      )}
      {seedMutation.error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{seedMutation.error.message}</p>
      )}
      {linkMutation.error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{linkMutation.error.message}</p>
      )}

      {!matrixQuery.isLoading && rows.length > 0 && data && (
        <>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900">
                المغطى: {data.coveredStandards} من {data.totalStandards} ({data.coveragePercent}%)
                {data.verifiedStandards > 0 ? ` · منها ${data.verifiedStandards} بشاهد ملف أصلي` : ""}
              </span>
              {data.weightedScorePercent !== null && (
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 font-bold text-teal-900">
                  الوزن المغطى: {data.weightedScorePercent}%
                </span>
              )}
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={data.coveragePercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${data.coveragePercent}%` }} />
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {rows.map(row => {
              const linkedIds = new Set(row.linkedAssets.map(item => item.assetId));
              const availableAssets = assets.filter(asset => {
                if (linkedIds.has(asset.id)) return false;
                if (!asset.ownerType) return true;
                if (activeSchoolId !== undefined) {
                  return asset.ownerType === "organization" && asset.ownerOrganizationId === activeSchoolId;
                }
                return asset.ownerType === "personal";
              });
              const chosenAssetId = selectedAssetByStandard[row.standardVersionId];

              return (
                <div key={row.standardVersionId} className="flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.status === "verified" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <ShieldCheck className="h-3 w-3" /> موثّق بشاهد أصلي
                        </span>
                      ) : row.status === "supporting" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-900">
                          <CheckCircle2 className="h-3 w-3" /> مغطى بمادة مساعدة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                          <CircleDashed className="h-3 w-3" /> ينقصه شاهد
                        </span>
                      )}
                      {row.weightPercent !== null && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                          الوزن {row.weightPercent}%
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">{row.standardKey}</span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-bold text-slate-900">{row.title}</h3>
                    {row.domainLabel && <p className="mt-0.5 text-xs text-slate-500">{row.domainLabel}</p>}
                    {row.linkedAssets.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.linkedAssets.map(item => (
                          <span key={item.assetId} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-800">
                            {item.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {availableAssets.length > 0 && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <select
                        aria-label={`ربط شاهد بمعيار ${row.title}`}
                        value={chosenAssetId ?? ""}
                        onChange={event => setSelectedAssetByStandard(current => ({
                          ...current,
                          [row.standardVersionId]: Number(event.target.value) || undefined,
                        }))}
                        className="max-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                      >
                        <option value="">اربط شاهدًا...</option>
                        {availableAssets.map(asset => (
                          <option key={asset.id} value={asset.id}>{asset.title}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!chosenAssetId || linkMutation.isPending}
                        onClick={() => chosenAssetId && linkMutation.mutate({ assetId: chosenAssetId, standardVersionId: row.standardVersionId })}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> ربط
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
