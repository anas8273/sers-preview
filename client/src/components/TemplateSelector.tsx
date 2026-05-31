/**
 * مكون اختيار القوالب والثيمات - مشترك بين جميع الصفحات التفاعلية
 * يدعم الثيمات المخصصة من قاعدة البيانات
 */
import { useState, useMemo } from "react";
import { Palette, Type, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

export interface ThemeConfig {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerBg: string;
  headerText: string;
  bodyBg: string;
  borderColor: string;
  fontFamily: string;
  isCustom?: boolean;
}

export const THEMES: ThemeConfig[] = [
  { id: "teal", name: "الأخضر الزمردي", primaryColor: "#0d9488", secondaryColor: "#14b8a6", accentColor: "#5eead4", headerBg: "#0d9488", headerText: "#ffffff", bodyBg: "#ffffff", borderColor: "#99f6e4", fontFamily: "Cairo" },
  { id: "blue", name: "الأزرق الملكي", primaryColor: "#1d4ed8", secondaryColor: "#3b82f6", accentColor: "#93c5fd", headerBg: "#1d4ed8", headerText: "#ffffff", bodyBg: "#ffffff", borderColor: "#bfdbfe", fontFamily: "Cairo" },
  { id: "purple", name: "البنفسجي الأنيق", primaryColor: "#7c3aed", secondaryColor: "#8b5cf6", accentColor: "#c4b5fd", headerBg: "#7c3aed", headerText: "#ffffff", bodyBg: "#ffffff", borderColor: "#ddd6fe", fontFamily: "Cairo" },
  { id: "red", name: "الأحمر الدافئ", primaryColor: "#dc2626", secondaryColor: "#ef4444", accentColor: "#fca5a5", headerBg: "#dc2626", headerText: "#ffffff", bodyBg: "#ffffff", borderColor: "#fecaca", fontFamily: "Cairo" },
  { id: "amber", name: "الذهبي الفاخر", primaryColor: "#d97706", secondaryColor: "#f59e0b", accentColor: "#fcd34d", headerBg: "#92400e", headerText: "#ffffff", bodyBg: "#fffbeb", borderColor: "#fde68a", fontFamily: "Cairo" },
  { id: "green", name: "الأخضر الطبيعي", primaryColor: "#059669", secondaryColor: "#10b981", accentColor: "#6ee7b7", headerBg: "#059669", headerText: "#ffffff", bodyBg: "#ffffff", borderColor: "#a7f3d0", fontFamily: "Cairo" },
];

export const FONT_OPTIONS = [
  { id: "Cairo", name: "القاهرة" },
  { id: "Tajawal", name: "تجوال" },
  { id: "Noto Kufi Arabic", name: "نوتو كوفي" },
  { id: "Amiri", name: "أميري" },
  { id: "Almarai", name: "المراعي" },
];

interface TemplateSelectorProps {
  selectedTheme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void;
  selectedFont?: string;
  onFontChange?: (font: string) => void;
  compact?: boolean;
}

export default function TemplateSelector({
  selectedTheme, onThemeChange, selectedFont, onFontChange, compact = false,
}: TemplateSelectorProps) {
  const [expanded, setExpanded] = useState(!compact);
  
  // Load custom themes from DB
  const { data: customThemes } = trpc.sectionConfigs.getActive.useQuery({ sectionId: "shared" });
  
  const allThemes = useMemo(() => {
    const base = [...THEMES];
    if (customThemes && customThemes.length > 0) {
      const builtinIds = new Set(THEMES.map(t => t.id));
      for (const cfg of customThemes) {
        if (cfg.configType === "theme" && cfg.data && !builtinIds.has(`custom-${cfg.id}`)) {
          const d = cfg.data as Record<string, any>;
          base.push({
            id: `custom-${cfg.id}`,
            name: cfg.name,
            primaryColor: d.primaryColor || "#0d9488",
            secondaryColor: d.secondaryColor || d.primaryColor || "#14b8a6",
            accentColor: d.accentColor || "#5eead4",
            headerBg: d.headerBg || d.primaryColor || "#0d9488",
            headerText: d.headerText || "#ffffff",
            bodyBg: d.bodyBg || "#ffffff",
            borderColor: d.borderColor || "#99f6e4",
            fontFamily: d.fontFamily || "Cairo",
            isCustom: true,
          });
        }
      }
    }
    return base;
  }, [customThemes]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>تخصيص التصميم</span>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{selectedTheme.name}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> اللون الرئيسي
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {allThemes.map((theme) => (
                <button key={theme.id} onClick={() => onThemeChange(theme)}
                  className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${selectedTheme.id === theme.id ? "border-gray-900 bg-gray-50 shadow-sm" : "border-transparent hover:border-gray-200 hover:bg-gray-50"}`}>
                  <div className="flex gap-0.5">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: theme.secondaryColor }} />
                  </div>
                  <span className="text-[10px] text-gray-600 leading-none">{theme.name}</span>
                  {(theme as any).isCustom && <Sparkles className="w-2.5 h-2.5 text-amber-500 absolute top-0.5 left-0.5" />}
                  {selectedTheme.id === theme.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          {onFontChange && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" /> نوع الخط
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {FONT_OPTIONS.map((font) => (
                  <button key={font.id} onClick={() => onFontChange(font.id)}
                    className={`p-2 rounded-lg border-2 text-center transition-all ${selectedFont === font.id ? "border-gray-900 bg-gray-50" : "border-transparent hover:border-gray-200 hover:bg-gray-50"}`}>
                    <span className="text-sm block" style={{ fontFamily: `'${font.id}', sans-serif` }}>{font.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
