import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Brain, Sparkles, TrendingUp, Shield, Zap, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "عالية", color: "#DC2626", bg: "bg-red-50" },
  medium: { label: "متوسطة", color: "#CA8A04", bg: "bg-amber-50" },
  low: { label: "منخفضة", color: "#16A34A", bg: "bg-green-50" },
};

const CATEGORY_ICONS: Record<string, any> = {
  engagement: Users,
  content: BarChart3,
  security: Shield,
  performance: Zap,
  growth: TrendingUp,
};

export default function AIPanel() {
  const { data: stats } = trpc.admin.advancedStats.useQuery();
  const aiMutation = trpc.admin.aiRecommendations.useMutation();
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const handleAnalyze = async () => {
    if (!stats) return;
    const result = await aiMutation.mutateAsync({ stats });
    if (result.recommendations) setRecommendations(result.recommendations);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>توصيات الذكاء الاصطناعي</h2>
          <p className="text-sm text-gray-500 mt-1">تحليل ذكي لأداء المنصة مع اقتراحات للتحسين</p>
        </div>
        <Button onClick={handleAnalyze} disabled={aiMutation.isPending || !stats} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 gap-2">
          {aiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          تحليل بالذكاء الاصطناعي
        </Button>
      </div>

      {/* AI Info */}
      {recommendations.length === 0 && !aiMutation.isPending && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>تحليل المنصة بالذكاء الاصطناعي</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
              اضغط على زر التحليل أعلاه ليقوم الذكاء الاصطناعي بتحليل إحصائيات المنصة وتقديم توصيات عملية لتحسين الأداء والمحتوى والأمان.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {["تحسين التفاعل", "أمان البيانات", "المحتوى", "النمو", "الأداء"].map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs bg-white border border-violet-200 text-violet-600">{tag}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {aiMutation.isPending && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-violet-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">جاري تحليل البيانات بالذكاء الاصطناعي...</p>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((rec, i) => {
            const priority = PRIORITY_MAP[rec.priority] || PRIORITY_MAP.medium;
            const CatIcon = CATEGORY_ICONS[rec.category] || Sparkles;
            return (
              <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${priority.bg} flex items-center justify-center shrink-0`}>
                      <CatIcon className="w-5 h-5" style={{ color: priority.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 text-sm">{rec.title}</h3>
                        <Badge style={{ backgroundColor: priority.color + "20", color: priority.color }} className="text-[9px]">{priority.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{rec.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
