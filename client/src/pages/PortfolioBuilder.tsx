/**
 * ملف الإنجاز المهني التفاعلي - SERS
 * يتيح للمعلم بناء ملف إنجاز رقمي شامل مع:
 * - تعبئة بالذكاء الاصطناعي
 * - معاينة حية بتصميم احترافي
 * - تصدير PDF
 * - 6 ثيمات/قوالب مختلفة
 */
import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, User, GraduationCap, Award, Briefcase,
  Target, Plus, Trash2, Save, Eye,
  Sparkles, FolderOpen, ChevronLeft, Loader2,
  FileDown, Printer, Maximize2, Minimize2, Building2, Star, ZoomIn, ZoomOut, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import TemplateSelector, { THEMES, type ThemeConfig } from "@/components/TemplateSelector";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { usePreviewScale } from "@/hooks/usePreviewScale";

const A4_WIDTH_PX = 793.7;

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface PersonalInfo {
  fullName: string; jobTitle: string; school: string; department: string;
  qualification: string; experience: string; email: string; phone: string;
}

interface Certificate {
  id: string; title: string; issuer: string; date: string; hours: string;
  type: "training" | "academic" | "professional";
}

interface Achievement {
  id: string; title: string; description: string; date: string;
  category: "award" | "initiative" | "project" | "community";
}

interface Activity {
  id: string; title: string; description: string; date: string;
  type: "school" | "department" | "ministry" | "external";
}

interface PortfolioData {
  personalInfo: PersonalInfo; certificates: Certificate[];
  achievements: Achievement[]; activities: Activity[];
  goals: string[]; notes: string;
}

type TabId = "personal" | "certificates" | "achievements" | "activities" | "goals" | "preview";

const TABS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
  { id: "personal", label: "البيانات الشخصية", icon: User },
  { id: "certificates", label: "الدورات والشهادات", icon: GraduationCap },
  { id: "achievements", label: "الإنجازات والجوائز", icon: Award },
  { id: "activities", label: "الأنشطة والمبادرات", icon: Target },
  { id: "goals", label: "الأهداف المهنية", icon: Sparkles },
  { id: "preview", label: "المعاينة والتصدير", icon: Eye },
];

const CERT_TYPES = [
  { value: "training", label: "تدريبية", color: "#0d9488" },
  { value: "academic", label: "أكاديمية", color: "#7c3aed" },
  { value: "professional", label: "مهنية", color: "#ea580c" },
];

const ACHIEVEMENT_CATS = [
  { value: "award", label: "جائزة", color: "#eab308" },
  { value: "initiative", label: "مبادرة", color: "#0d9488" },
  { value: "project", label: "مشروع", color: "#3b82f6" },
  { value: "community", label: "مجتمعي", color: "#ec4899" },
];

const ACTIVITY_TYPES = [
  { value: "school", label: "مدرسي" },
  { value: "department", label: "إداري" },
  { value: "ministry", label: "وزاري" },
  { value: "external", label: "خارجي" },
];

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const STORAGE_KEY = "sers-portfolio-data";

function loadPortfolio(): PortfolioData {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
  return {
    personalInfo: { fullName: "", jobTitle: "", school: "", department: "", qualification: "", experience: "", email: "", phone: "" },
    certificates: [], achievements: [], activities: [], goals: [""], notes: "",
  };
}
function savePortfolioToStorage(data: PortfolioData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

// ═══════════════════════════════════════════════════════════════
// Portfolio Preview Component
// ═══════════════════════════════════════════════════════════════

function PortfolioPreview({ data, theme, fontFamily }: { data: PortfolioData; theme: ThemeConfig; fontFamily: string }) {
  const p = data.personalInfo;
  return (
    <div style={{ width: "210mm", minHeight: "297mm", fontFamily: `'${fontFamily}', sans-serif`, direction: "rtl", background: "#fff" }}>
      {/* Cover Page */}
      <div style={{ width: "210mm", height: "297mm", background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: theme.headerText, padding: "40px", textAlign: "center", pageBreakAfter: "always" }}>
        <div style={{ width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
          <span style={{ fontSize: "40px", fontWeight: "800" }}>{p.fullName ? p.fullName.charAt(0) : "م"}</span>
        </div>
        <div style={{ width: "60px", height: "3px", backgroundColor: "rgba(255,255,255,0.3)", margin: "12px auto" }} />
        <h1 style={{ fontSize: "32px", fontWeight: "900", margin: "12px 0", fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>ملف الإنجاز المهني</h1>
        <p style={{ fontSize: "14px", opacity: 0.8, marginBottom: "24px" }}>Professional Portfolio</p>
        <div style={{ width: "60px", height: "3px", backgroundColor: "rgba(255,255,255,0.3)", margin: "12px auto" }} />
        <h2 style={{ fontSize: "24px", fontWeight: "700", marginTop: "16px" }}>{p.fullName || "الاسم الكامل"}</h2>
        <p style={{ fontSize: "14px", opacity: 0.8, marginTop: "8px" }}>{p.jobTitle || "المسمى الوظيفي"}</p>
        {p.school && <p style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>{p.school}</p>}
        <div style={{ marginTop: "40px", fontSize: "11px", opacity: 0.5 }}>
          <p>نظام السجلات التعليمية الذكي - SERS</p>
          <p style={{ marginTop: "4px" }}>{new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long" })}</p>
        </div>
      </div>

      {/* Personal Info Page */}
      <div style={{ width: "210mm", minHeight: "297mm", padding: "32px", pageBreakAfter: "always" }}>
        <div data-pdf-header style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`, color: theme.headerText, padding: "16px 24px", borderRadius: "12px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "18px" }}>👤</span>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>البيانات الشخصية</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
          {[
            { label: "الاسم الكامل", value: p.fullName },
            { label: "المسمى الوظيفي", value: p.jobTitle },
            { label: "المدرسة / الجهة", value: p.school },
            { label: "القسم / التخصص", value: p.department },
            { label: "المؤهل العلمي", value: p.qualification },
            { label: "سنوات الخبرة", value: p.experience },
            { label: "البريد الإلكتروني", value: p.email },
            { label: "رقم الهاتف", value: p.phone },
          ].map((item, i) => (
            <div key={i} style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "#f9fafb", border: `1px solid ${theme.borderColor}` }}>
              <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontWeight: "600", color: "#1f2937" }}>{item.value || "---"}</div>
            </div>
          ))}
        </div>

        {/* Certificates */}
        {data.certificates.length > 0 && (
          <>
            <div data-pdf-header style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`, color: theme.headerText, padding: "16px 24px", borderRadius: "12px", marginTop: "32px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "18px" }}>🎓</span>
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>الدورات والشهادات ({data.certificates.length})</h2>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: theme.primaryColor + "10" }}>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: theme.primaryColor, borderBottom: `2px solid ${theme.borderColor}` }}>م</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: theme.primaryColor, borderBottom: `2px solid ${theme.borderColor}` }}>اسم الدورة / الشهادة</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: theme.primaryColor, borderBottom: `2px solid ${theme.borderColor}` }}>الجهة المانحة</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: theme.primaryColor, borderBottom: `2px solid ${theme.borderColor}` }}>التاريخ</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: theme.primaryColor, borderBottom: `2px solid ${theme.borderColor}` }}>الساعات</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: theme.primaryColor, borderBottom: `2px solid ${theme.borderColor}` }}>النوع</th>
                </tr>
              </thead>
              <tbody>
                {data.certificates.map((cert, i) => {
                  const ct = CERT_TYPES.find((t) => t.value === cert.type);
                  return (
                    <tr key={cert.id} style={{ borderBottom: `1px solid ${theme.borderColor}` }}>
                      <td style={{ padding: "8px 12px", color: "#6b7280" }}>{i + 1}</td>
                      <td style={{ padding: "8px 12px", fontWeight: "600", color: "#1f2937" }}>{cert.title || "---"}</td>
                      <td style={{ padding: "8px 12px", color: "#4b5563" }}>{cert.issuer || "---"}</td>
                      <td style={{ padding: "8px 12px", color: "#4b5563" }}>{cert.date || "---"}</td>
                      <td style={{ padding: "8px 12px", color: "#4b5563" }}>{cert.hours || "---"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "600", backgroundColor: (ct?.color || "#6b7280") + "15", color: ct?.color || "#6b7280" }}>
                          {ct?.label || "---"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Achievements & Activities Page */}
      {(data.achievements.length > 0 || data.activities.length > 0 || data.goals.filter(g => g.trim()).length > 0) && (
        <div style={{ width: "210mm", minHeight: "297mm", padding: "32px", pageBreakAfter: "always" }}>
          {data.achievements.length > 0 && (
            <>
              <div data-pdf-header style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`, color: theme.headerText, padding: "16px 24px", borderRadius: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "18px" }}>🏆</span>
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>الإنجازات والجوائز ({data.achievements.length})</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "28px" }}>
                {data.achievements.map((ach, i) => {
                  const cat = ACHIEVEMENT_CATS.find((c) => c.value === ach.category);
                  return (
                    <div key={ach.id} style={{ padding: "14px", borderRadius: "10px", border: `1px solid ${theme.borderColor}`, backgroundColor: "#fafafa" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#1f2937" }}>{ach.title || "---"}</span>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "600", backgroundColor: (cat?.color || "#6b7280") + "15", color: cat?.color || "#6b7280" }}>{cat?.label || "---"}</span>
                      </div>
                      {ach.description && <p style={{ fontSize: "11px", color: "#6b7280", lineHeight: "1.6", margin: 0 }}>{ach.description}</p>}
                      {ach.date && <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: "6px" }}>{ach.date}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {data.activities.length > 0 && (
            <>
              <div data-pdf-header style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`, color: theme.headerText, padding: "16px 24px", borderRadius: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "18px" }}>🎯</span>
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>الأنشطة والمبادرات ({data.activities.length})</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "28px" }}>
                {data.activities.map((act) => {
                  const at = ACTIVITY_TYPES.find((t) => t.value === act.type);
                  return (
                    <div key={act.id} style={{ padding: "14px", borderRadius: "10px", border: `1px solid ${theme.borderColor}`, backgroundColor: "#fafafa" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#1f2937" }}>{act.title || "---"}</span>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "600", backgroundColor: theme.primaryColor + "15", color: theme.primaryColor }}>{at?.label || "---"}</span>
                      </div>
                      {act.description && <p style={{ fontSize: "11px", color: "#6b7280", lineHeight: "1.6", margin: 0 }}>{act.description}</p>}
                      {act.date && <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: "6px" }}>{act.date}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {data.goals.filter(g => g.trim()).length > 0 && (
            <>
              <div data-pdf-header style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`, color: theme.headerText, padding: "16px 24px", borderRadius: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "18px" }}>✨</span>
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>الأهداف المهنية</h2>
              </div>
              <div style={{ paddingRight: "8px" }}>
                {data.goals.filter(g => g.trim()).map((goal, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                    <span data-pdf-accent style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: theme.primaryColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>{i + 1}</span>
                    <p style={{ fontSize: "13px", color: "#374151", lineHeight: "1.8", margin: 0 }}>{goal}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {data.notes && (
            <div style={{ marginTop: "24px", padding: "16px", borderRadius: "10px", backgroundColor: "#f9fafb", border: `1px solid ${theme.borderColor}` }}>
              <h4 style={{ fontSize: "13px", fontWeight: "700", color: theme.primaryColor, marginBottom: "8px" }}>ملاحظات إضافية</h4>
              <p style={{ fontSize: "12px", color: "#4b5563", lineHeight: "1.8", margin: 0 }}>{data.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: `2px solid ${theme.borderColor}`, padding: "12px 32px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" }}>
        <span>تم إنشاؤه بواسطة منصة SERS</span>
        <span>{new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function PortfolioBuilder() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [data, setData] = useState<PortfolioData>(loadPortfolio);
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig>(THEMES[0]);
  const [selectedFont, setSelectedFont] = useState("Cairo");
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const { containerRef: previewContainerRef, pageRef: previewPageRef, previewScale, wrapperWidth, wrapperHeight, zoomLevel, zoomIn, zoomOut, resetZoom } = usePreviewScale();

  const generatePortfolioMutation = trpc.genAI.generatePortfolioContent.useMutation();

  const updateData = useCallback((updater: (prev: PortfolioData) => PortfolioData) => {
    setData((prev) => { const next = updater(prev); savePortfolioToStorage(next); return next; });
  }, []);

  const updatePersonal = useCallback((field: keyof PersonalInfo, value: string) => {
    updateData((prev) => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
  }, [updateData]);

  // Certificate CRUD
  const addCertificate = useCallback(() => {
    updateData((prev) => ({ ...prev, certificates: [...prev.certificates, { id: genId(), title: "", issuer: "", date: "", hours: "", type: "training" as const }] }));
  }, [updateData]);

  const updateCertificate = useCallback((id: string, field: keyof Certificate, value: string) => {
    updateData((prev) => ({ ...prev, certificates: prev.certificates.map((c) => c.id === id ? { ...c, [field]: value } : c) }));
  }, [updateData]);

  const removeCertificate = useCallback((id: string) => {
    updateData((prev) => ({ ...prev, certificates: prev.certificates.filter((c) => c.id !== id) }));
  }, [updateData]);

  // Achievement CRUD
  const addAchievement = useCallback(() => {
    updateData((prev) => ({ ...prev, achievements: [...prev.achievements, { id: genId(), title: "", description: "", date: "", category: "award" as const }] }));
  }, [updateData]);

  const updateAchievement = useCallback((id: string, field: keyof Achievement, value: string) => {
    updateData((prev) => ({ ...prev, achievements: prev.achievements.map((a) => a.id === id ? { ...a, [field]: value } : a) }));
  }, [updateData]);

  const removeAchievement = useCallback((id: string) => {
    updateData((prev) => ({ ...prev, achievements: prev.achievements.filter((a) => a.id !== id) }));
  }, [updateData]);

  // Activity CRUD
  const addActivity = useCallback(() => {
    updateData((prev) => ({ ...prev, activities: [...prev.activities, { id: genId(), title: "", description: "", date: "", type: "school" as const }] }));
  }, [updateData]);

  const updateActivity = useCallback((id: string, field: keyof Activity, value: string) => {
    updateData((prev) => ({ ...prev, activities: prev.activities.map((a) => a.id === id ? { ...a, [field]: value } : a) }));
  }, [updateData]);

  const removeActivity = useCallback((id: string) => {
    updateData((prev) => ({ ...prev, activities: prev.activities.filter((a) => a.id !== id) }));
  }, [updateData]);

  // Goals
  const addGoal = useCallback(() => { updateData((prev) => ({ ...prev, goals: [...prev.goals, ""] })); }, [updateData]);
  const updateGoal = useCallback((index: number, value: string) => { updateData((prev) => ({ ...prev, goals: prev.goals.map((g, i) => i === index ? value : g) })); }, [updateData]);
  const removeGoal = useCallback((index: number) => { updateData((prev) => ({ ...prev, goals: prev.goals.filter((_, i) => i !== index) })); }, [updateData]);

  const handleSave = useCallback(() => { savePortfolioToStorage(data); toast.success("تم حفظ ملف الإنجاز بنجاح"); }, [data]);

  const handleAIGenerate = useCallback(async () => {
    if (!data.personalInfo.fullName && !data.personalInfo.jobTitle) {
      toast.error("أدخل الاسم والمسمى الوظيفي أولاً"); return;
    }
    setAiLoading(true);
    try {
      const result = await generatePortfolioMutation.mutateAsync({
        section: "ملف إنجاز شامل",
        jobTitle: data.personalInfo.jobTitle || "معلم",
        existingData: `الاسم: ${data.personalInfo.fullName}\nالمدرسة: ${data.personalInfo.school}\nالقسم: ${data.personalInfo.department}`,
      });
      if (result.content) {
        // Parse AI response - try JSON first, then extract from text
        let ai: any = {};
        try {
          ai = JSON.parse(result.content);
        } catch {
          // AI returned text, create structured data from it
          ai = {
            certificates: [{ title: "دورة التطوير المهني", issuer: "وزارة التعليم", date: "1445/06", hours: "30", type: "training" }],
            achievements: [{ title: "التميز في الأداء الوظيفي", description: result.content.slice(0, 200), date: "1445", category: "award" }],
            activities: [{ title: "مبادرة تطوير التعليم", description: "مبادرة لتحسين مخرجات التعلم", date: "1445", type: "school" }],
            goals: ["تطوير الممارسات التعليمية", "المساهمة في تحقيق رؤية 2030", "الحصول على شهادات مهنية متقدمة"],
          };
        }
        updateData((prev) => ({
          ...prev,
          personalInfo: {
            ...prev.personalInfo,
            qualification: ai.qualification || prev.personalInfo.qualification,
          },
          certificates: ai.certificates?.length ? ai.certificates.map((c: any) => ({
            id: genId(), title: c.title || "", issuer: c.issuer || "", date: c.date || "", hours: c.hours || "", type: (c.type || "training") as Certificate["type"],
          })) : prev.certificates,
          achievements: ai.achievements?.length ? ai.achievements.map((a: any) => ({
            id: genId(), title: a.title || "", description: a.description || "", date: a.date || "", category: (a.category || "award") as Achievement["category"],
          })) : prev.achievements,
          activities: ai.activities?.length ? ai.activities.map((a: any) => ({
            id: genId(), title: a.title || "", description: a.description || "", date: a.date || "", type: (a.type || "school") as Activity["type"],
          })) : prev.activities,
          goals: ai.goals?.length ? ai.goals : prev.goals,
        }));
        toast.success("تم توليد محتوى ملف الإنجاز بالذكاء الاصطناعي");
      }
    } catch { toast.error("حدث خطأ أثناء التوليد"); }
    finally { setAiLoading(false); }
  }, [data.personalInfo, generatePortfolioMutation, updateData]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try { await exportToPDF("portfolio-preview-content", `ملف_الإنجاز_${data.personalInfo.fullName || "المهني"}.pdf`); toast.success("تم تصدير PDF بنجاح"); }
    catch { toast.error("حدث خطأ أثناء التصدير"); }
    finally { setExporting(false); }
  }, [data.personalInfo.fullName]);

  const handlePrint = useCallback(() => { try { printElement("portfolio-preview-content"); } catch { toast.error("حدث خطأ"); } }, []);

  const completionPercentage = useMemo(() => {
    let total = 0; let filled = 0;
    const fields = Object.values(data.personalInfo);
    total += fields.length; filled += fields.filter((v) => v.trim()).length;
    total += 2; filled += data.certificates.length > 0 ? 2 : 0;
    total += 2; filled += data.achievements.length > 0 ? 2 : 0;
    total += 2; filled += data.activities.length > 0 ? 2 : 0;
    total += 1; filled += data.goals.filter((g) => g.trim()).length > 0 ? 1 : 0;
    return Math.round((filled / total) * 100);
  }, [data]);

  return (
    <div className="min-h-screen pb-20 lg:pb-0 bg-[#F8FAFC]" dir="rtl">
      {/* Header */}
      <div className="w-full bg-gradient-to-l from-teal-700 via-teal-600 to-emerald-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-white/70 hover:text-white mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /><span className="text-sm">العودة للرئيسية</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <FolderOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>ملف الإنجاز المهني</h1>
                <p className="text-white/80 text-sm mt-1">بناء ملف إنجاز رقمي احترافي شامل</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                <div className="text-2xl font-black text-white">{completionPercentage}%</div>
                <div className="text-[10px] text-white/70">مكتمل</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Theme Selector */}
        <div className="mb-4">
          <TemplateSelector selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} selectedFont={selectedFont} onFontChange={setSelectedFont} compact />
        </div>

        {/* AI Generate Button */}
        <div className="mb-4 flex items-center gap-2">
          <Button onClick={handleAIGenerate} variant="outline" disabled={aiLoading}
            className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50">
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiLoading ? "جاري التوليد..." : "تعبئة بالذكاء الاصطناعي"}
          </Button>
          <span className="text-xs text-gray-400">يولّد محتوى تجريبي بناءً على بياناتك الشخصية</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar tabs */}
          <div className="lg:w-56 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-2 sticky top-4">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${isActive ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50"}`}>
                    <Icon className="w-4 h-4 shrink-0" /> {tab.label}
                  </button>
                );
              })}
              <hr className="my-2 border-gray-100" />
              <Button onClick={handleSave} variant="outline" className="w-full text-sm gap-2"><Save className="w-4 h-4" /> حفظ</Button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1">
            <>
              {/* Personal Info Tab */}
              {activeTab === "personal" && (
                <div key="personal">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                      <User className="w-5 h-5 text-teal-600" /> البيانات الشخصية
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {([
                        { key: "fullName" as const, label: "الاسم الكامل", placeholder: "أدخل الاسم الرباعي" },
                        { key: "jobTitle" as const, label: "المسمى الوظيفي", placeholder: "معلم / مشرف / قائد مدرسة" },
                        { key: "school" as const, label: "المدرسة / الجهة", placeholder: "اسم المدرسة أو الجهة" },
                        { key: "department" as const, label: "القسم / التخصص", placeholder: "القسم أو التخصص" },
                        { key: "qualification" as const, label: "المؤهل العلمي", placeholder: "بكالوريوس / ماجستير / دكتوراه" },
                        { key: "experience" as const, label: "سنوات الخبرة", placeholder: "عدد سنوات الخبرة" },
                        { key: "email" as const, label: "البريد الإلكتروني", placeholder: "example@email.com" },
                        { key: "phone" as const, label: "رقم الهاتف", placeholder: "05xxxxxxxx" },
                      ]).map((field) => (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                          <input type="text" value={data.personalInfo[field.key]} onChange={(e) => updatePersonal(field.key, e.target.value)} placeholder={field.placeholder}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Certificates Tab */}
              {activeTab === "certificates" && (
                <div key="certificates">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                        <GraduationCap className="w-5 h-5 text-teal-600" /> الدورات والشهادات ({data.certificates.length})
                      </h2>
                      <Button onClick={addCertificate} size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"><Plus className="w-4 h-4" /> إضافة</Button>
                    </div>
                    {data.certificates.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">لا توجد دورات مضافة بعد</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.certificates.map((cert, index) => (
                          <div key={cert.id} className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-gray-400">شهادة #{index + 1}</span>
                              <div className="flex items-center gap-1">
                                {CERT_TYPES.map((t) => (
                                  <button key={t.value} onClick={() => updateCertificate(cert.id, "type", t.value)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${cert.type === t.value ? "text-white" : "bg-gray-100 text-gray-500"}`}
                                    style={cert.type === t.value ? { backgroundColor: t.color } : {}}>
                                    {t.label}
                                  </button>
                                ))}
                                <button onClick={() => removeCertificate(cert.id)} className="p-1 text-red-400 hover:text-red-600 mr-2"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input type="text" value={cert.title} onChange={(e) => updateCertificate(cert.id, "title", e.target.value)} placeholder="اسم الدورة / الشهادة"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                              <input type="text" value={cert.issuer} onChange={(e) => updateCertificate(cert.id, "issuer", e.target.value)} placeholder="الجهة المانحة"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                              <input type="text" value={cert.date} onChange={(e) => updateCertificate(cert.id, "date", e.target.value)} placeholder="التاريخ (مثال: 1445/06)"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                              <input type="text" value={cert.hours} onChange={(e) => updateCertificate(cert.id, "hours", e.target.value)} placeholder="عدد الساعات"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Achievements Tab */}
              {activeTab === "achievements" && (
                <div key="achievements">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                        <Award className="w-5 h-5 text-teal-600" /> الإنجازات والجوائز ({data.achievements.length})
                      </h2>
                      <Button onClick={addAchievement} size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"><Plus className="w-4 h-4" /> إضافة</Button>
                    </div>
                    {data.achievements.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">لا توجد إنجازات مضافة بعد</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.achievements.map((ach, index) => (
                          <div key={ach.id} className="border border-gray-100 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-gray-400">إنجاز #{index + 1}</span>
                              <div className="flex items-center gap-1">
                                {ACHIEVEMENT_CATS.map((c) => (
                                  <button key={c.value} onClick={() => updateAchievement(ach.id, "category", c.value)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${ach.category === c.value ? "text-white" : "bg-gray-100 text-gray-500"}`}
                                    style={ach.category === c.value ? { backgroundColor: c.color } : {}}>
                                    {c.label}
                                  </button>
                                ))}
                                <button onClick={() => removeAchievement(ach.id)} className="p-1 text-red-400 hover:text-red-600 mr-2"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input type="text" value={ach.title} onChange={(e) => updateAchievement(ach.id, "title", e.target.value)} placeholder="عنوان الإنجاز"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                              <input type="text" value={ach.date} onChange={(e) => updateAchievement(ach.id, "date", e.target.value)} placeholder="التاريخ"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                              <textarea value={ach.description} onChange={(e) => updateAchievement(ach.id, "description", e.target.value)} placeholder="وصف الإنجاز" rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 md:col-span-2 resize-y" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Activities Tab */}
              {activeTab === "activities" && (
                <div key="activities">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                        <Target className="w-5 h-5 text-teal-600" /> الأنشطة والمبادرات ({data.activities.length})
                      </h2>
                      <Button onClick={addActivity} size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"><Plus className="w-4 h-4" /> إضافة</Button>
                    </div>
                    {data.activities.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">لا توجد أنشطة مضافة بعد</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.activities.map((act, index) => (
                          <div key={act.id} className="border border-gray-100 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-gray-400">نشاط #{index + 1}</span>
                              <div className="flex items-center gap-1">
                                {ACTIVITY_TYPES.map((t) => (
                                  <button key={t.value} onClick={() => updateActivity(act.id, "type", t.value)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${act.type === t.value ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"}`}>
                                    {t.label}
                                  </button>
                                ))}
                                <button onClick={() => removeActivity(act.id)} className="p-1 text-red-400 hover:text-red-600 mr-2"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input type="text" value={act.title} onChange={(e) => updateActivity(act.id, "title", e.target.value)} placeholder="عنوان النشاط"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                              <input type="text" value={act.date} onChange={(e) => updateActivity(act.id, "date", e.target.value)} placeholder="التاريخ"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                              <textarea value={act.description} onChange={(e) => updateActivity(act.id, "description", e.target.value)} placeholder="وصف النشاط" rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 md:col-span-2 resize-y" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Goals Tab */}
              {activeTab === "goals" && (
                <div key="goals">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                        <Sparkles className="w-5 h-5 text-teal-600" /> الأهداف المهنية ({data.goals.filter(g => g.trim()).length})
                      </h2>
                      <Button onClick={addGoal} size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"><Plus className="w-4 h-4" /> إضافة هدف</Button>
                    </div>
                    <div className="space-y-3">
                      {data.goals.map((goal, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-teal-400 shrink-0 w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center">{index + 1}</span>
                          <input type="text" value={goal} onChange={(e) => updateGoal(index, e.target.value)} placeholder="اكتب هدفاً مهنياً..."
                            className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                          {data.goals.length > 1 && (
                            <button onClick={() => removeGoal(index)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">ملاحظات إضافية</label>
                      <textarea value={data.notes} onChange={(e) => updateData((prev) => ({ ...prev, notes: e.target.value }))} placeholder="أي ملاحظات أو معلومات إضافية..."
                        rows={4} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-y" />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Tab */}
              {activeTab === "preview" && (
                <div key="preview"
                  className={fullscreen ? "fixed inset-0 z-50 bg-gray-100 overflow-auto" : ""}>
                  <div className={`bg-white border-b border-gray-200 ${fullscreen ? "sticky top-0 z-10 shadow-sm" : "rounded-t-xl border border-gray-200"}`}>
                    <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {fullscreen && <button onClick={() => setFullscreen(false)} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>}
                        <Eye className="w-4 h-4 text-teal-500 hidden sm:block" />
                        <span className="text-xs sm:text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة ملف الإنجاز</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-1 sm:gap-1.5 text-xs h-8 sm:h-9 bg-teal-600 hover:bg-teal-700 text-white">
                          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{exporting ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                          <span className="sm:hidden">PDF</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} className="p-1.5 h-8 sm:h-9">
                          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 pb-2 sm:pb-3 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                      <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 shrink-0">
                        <button onClick={zoomOut} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors active:scale-95" title="تصغير">
                          <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <div className="px-1.5 min-w-[2.5rem] text-center">
                          <span className="text-[10px] font-mono text-gray-700 font-medium">{zoomLevel}%</span>
                        </div>
                        <button onClick={zoomIn} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors active:scale-95" title="تكبير">
                          <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-0.5" />
                        <button onClick={resetZoom} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors active:scale-95" title="إعادة الحجم الأصلي">
                          <RotateCcw className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                      <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-xs h-8 shrink-0">
                        <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">طباعة</span>
                      </Button>
                    </div>
                  </div>
                  {/* Preview Content - A4 مضغوط بـ transform: scale() */}
                  <div ref={previewContainerRef} className={`bg-gray-200 overflow-auto ${fullscreen ? "h-[calc(100vh-52px)]" : "max-h-[80vh] rounded-b-xl border-x border-b border-gray-200"}`} style={{ padding: '8px 4px', minHeight: '200px' }}>
                    <div style={{ width: `${wrapperWidth}px`, height: `${wrapperHeight}px`, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ width: `${A4_WIDTH_PX}px`, transformOrigin: 'top right', transform: `scale(${previewScale})`, transition: 'transform 0.15s ease-out' }}>
                        <div id="portfolio-preview-content" ref={previewPageRef} style={{ fontFamily: "'Cairo', sans-serif", direction: 'rtl', width: '210mm' }}>
                          <PortfolioPreview data={data} theme={selectedTheme} fontFamily={selectedFont} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          </div>
        </div>
      </div>
    </div>
  );
}
