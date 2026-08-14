/**
 * ReportPreviewRenderer — مكون مشترك لعرض معاينة التقرير
 * يُستخدم في لوحة الإدارة (editable=true) وعند المستخدم
 * يرسم: غلاف + صفحة داخلية — طبق الأصل للـ PE
 * يدعم: 6 أنماط غلاف + 5 أنماط ترويسة + أنماط عنوان/حقول/توقيع
 */
import { getMoeLogoUrl, getMoeLogoFilter } from "@/components/MoeLogo";

export interface ThemePreviewConfig {
  [key: string]: any;
  accent?: string;
  headerBg?: string;
  headerText?: string;
  borderColor?: string;
  titleBg?: string;
  fieldLabelBg?: string;
  footerBg?: string;
  bodyBg?: string;
  coverAccent2?: string;
  coverStyle?: string;
  headerVariant?: string;
  titleStyle?: string;
  fieldStyle?: string;
  signatureStyle?: string;
  sectionCoverStyle?: string;
  showTopLine?: boolean;
  showBottomBar?: boolean;
  headerSeparator?: boolean;
  tableStyle?: boolean;
  coverImage?: string;
  headerLine1?: string;
  headerLine2?: string;
  footerText?: string;
  coverSubtitle?: string;
  name?: string;
}

interface Props {
  theme: ThemePreviewConfig;
  jobTitle?: string;
  scale?: number;
  showCover?: boolean;
  showInnerPage?: boolean;
  editable?: boolean;
  onTextChange?: (key: string, value: string) => void;
}

export default function ReportPreviewRenderer({
  theme,
  jobTitle = "المعلم",
  scale = 0.35,
  showCover = true,
  showInnerPage = true,
  editable = false,
  onTextChange,
}: Props) {
  const t = theme;
  const accent = t.accent || "#1a6b6a";
  const a2 = t.coverAccent2 || accent;
  const headerBg = t.headerBg || accent;
  const headerText = t.headerText || "#ffffff";
  const isDark = (() => {
    const hex = headerBg.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16),
      g = parseInt(hex.slice(2, 4), 16),
      b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  })();
  const titleBg = t.titleBg || accent;
  const footerBg = t.footerBg || accent;
  const borderColor = t.borderColor || accent;
  const fieldLabelBg = t.fieldLabelBg || "#f0fdf4";
  const bodyBg = t.bodyBg || "#ffffff";
  const cs = t.coverStyle || "gradient-center";
  const hv = t.headerVariant || "right-text-center-logo-left-info";
  const ts = t.titleStyle || "rounded";
  const fs = t.fieldStyle || "fieldset";
  const ss = t.signatureStyle || "dotted";
  const hLine1 = t.headerLine1 || "المملكة العربية السعودية";
  const hLine2 = t.headerLine2 || "وزارة التعليم";
  const footerText = t.footerText || "شواهد الأداء الوظيفي — نظام SERS";
  const reportTitle = t.name || "شواهد الأداء الوظيفي";
  const coverSub = t.coverSubtitle || "السجلات التعليمية الذكية";

  let MOE_LOGO: string;
  try { MOE_LOGO = getMoeLogoUrl(); } catch { MOE_LOGO = ""; }

  // ═══ Shared header for cover ═══
  const coverHeader = (
    <div style={{ background: `linear-gradient(to left, ${accent}, ${a2})`, padding: "14px 24px 10px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ width: "35%", verticalAlign: "middle", textAlign: "right", padding: 0 }}>
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 700, lineHeight: "2.0" }}>{hLine1}</div>
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 700, lineHeight: "2.0" }}>{hLine2}</div>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, lineHeight: "2.0" }}>إدارة التعليم</div>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, lineHeight: "2.0" }}>مدرسة النموذجية</div>
            </td>
            <td style={{ width: "2%", verticalAlign: "middle", textAlign: "center", padding: "0 4px" }}>
              <div style={{ width: 2, height: 55, background: "rgba(255,255,255,0.35)", margin: "0 auto" }} />
            </td>
            <td style={{ width: "28%", verticalAlign: "middle", textAlign: "center", padding: 0 }}>
              {MOE_LOGO ? (
                <img src={MOE_LOGO} alt="شعار وزارة التعليم" style={{ height: 60, objectFit: "contain", margin: "0 auto", display: "block", filter: "brightness(0) invert(1)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><span style={{ fontSize: 24, filter: "brightness(0) invert(1)" }}>🏛️</span></div>
              )}
            </td>
            <td style={{ width: "35%", verticalAlign: "middle", textAlign: "left", padding: 0 }}>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, lineHeight: "1.8" }}>الفصل الدراسي: الأول</div>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, lineHeight: "1.8" }}>العام الدراسي: 1446-1447هـ</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // ═══ Cover content ═══
  const coverContent = (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: "0.75rem", fontFamily: "'Cairo', sans-serif" }}>{reportTitle}</h1>
      <p style={{ fontSize: "1.4rem", fontWeight: 700, opacity: 0.95, marginBottom: "0.5rem" }}>{jobTitle}</p>
      <div style={{ width: 50, height: 2, background: "rgba(255,255,255,0.25)", margin: "1rem auto" }} />
      <p style={{ fontSize: "1rem", opacity: 0.85 }}>1446-1447هـ - الفصل الأول</p>
      <div style={{ marginTop: "3rem", display: "flex", justifyContent: "center", gap: "3rem", fontSize: "0.9rem", opacity: 0.9 }}>
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <div style={{ fontSize: "0.7rem", opacity: 0.6, marginBottom: "0.3rem" }}>الاسم</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>أحمد محمد</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <div style={{ fontSize: "0.7rem", opacity: 0.6, marginBottom: "0.3rem" }}>المدرسة</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>متوسطة النموذجية</div>
        </div>
      </div>
      <div style={{ marginTop: "4rem", fontSize: "0.7rem", opacity: 0.5 }}>نظام SERS — {coverSub}</div>
    </div>
  );

  // ═══ Inner page header ═══
  const renderInnerHeader = () => {
    const hBg = isDark ? headerBg : "#ffffff";
    const hText = isDark ? "#ffffff" : (t.headerText || borderColor || "#1a3a5c");

    if (hv === "right-text-center-logo-left-info") {
      return (
        <>
          {!isDark && <div style={{ height: 5, background: accent }} />}
          <div style={{ background: hBg, padding: isDark ? "16px 24px 12px" : "18px 24px 14px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ width: "35%", verticalAlign: "middle", textAlign: "right", padding: 0 }}>
                    <div style={{ fontSize: 13, color: hText, fontWeight: 700, lineHeight: "2.0" }}>{hLine1}</div>
                    <div style={{ fontSize: 13, color: hText, fontWeight: 700, lineHeight: "2.0" }}>{hLine2}</div>
                    <div style={{ fontSize: 13, color: hText, fontWeight: 700, lineHeight: "2.0" }}>إدارة التعليم</div>
                    <div style={{ fontSize: 13, color: hText, fontWeight: 700, lineHeight: "2.0" }}>مدرسة النموذجية</div>
                  </td>
                  <td style={{ width: "2%", verticalAlign: "middle", textAlign: "center", padding: "0 4px" }}>
                    <div style={{ width: 2, height: 55, background: isDark ? "rgba(255,255,255,0.35)" : accent, margin: "0 auto" }} />
                  </td>
                  <td style={{ width: "28%", verticalAlign: "middle", textAlign: "center", padding: 0 }}>
                    {MOE_LOGO ? (
                      <img src={MOE_LOGO} alt="شعار" style={{ height: 80, objectFit: "contain", margin: "0 auto", display: "block", filter: getMoeLogoFilter(isDark) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div style={{ width: 70, height: 70, borderRadius: "50%", backgroundColor: isDark ? "rgba(255,255,255,0.15)" : `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><span style={{ fontSize: 28 }}>🏛️</span></div>
                    )}
                  </td>
                  <td style={{ width: "35%", verticalAlign: "middle", textAlign: "left", padding: 0 }}>
                    <div style={{ fontSize: 12, color: hText, fontWeight: 600, lineHeight: "1.8" }}>الفصل الدراسي: الأول</div>
                    <div style={{ fontSize: 12, color: hText, fontWeight: 600, lineHeight: "1.8" }}>العام الدراسي: 1446-1447هـ</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {t.headerSeparator && <div style={{ height: 2, background: borderColor }} />}
        </>
      );
    }
    // Compact header for other variants
    return (
      <div style={{ background: `linear-gradient(to left, ${accent}, ${a2})`, padding: "12px 24px 10px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ width: "35%", verticalAlign: "middle", textAlign: "right", padding: 0 }}>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 700, lineHeight: "2.0" }}>{hLine1}</div>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 700, lineHeight: "2.0" }}>{hLine2}</div>
              </td>
              <td style={{ width: "28%", verticalAlign: "middle", textAlign: "center", padding: 0 }}>
                {MOE_LOGO ? <img src={MOE_LOGO} alt="شعار" style={{ height: 60, objectFit: "contain", margin: "0 auto", display: "block", filter: "brightness(0) invert(1)" }} /> : <span style={{ fontSize: 24 }}>🏛️</span>}
              </td>
              <td style={{ width: "35%", verticalAlign: "middle", textAlign: "left", padding: 0 }}>
                <div style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>1446-1447هـ</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // ═══ Title bar ═══
  const renderTitle = () => {
    const title = `${reportTitle} — ${jobTitle}`;
    if (ts === "rounded" && !isDark) {
      return (
        <div style={{ padding: "10px 28px", margin: "4px 0" }}>
          <div style={{ border: `2px solid ${accent}80`, borderRadius: 22, padding: "11px 24px", textAlign: "center", fontWeight: 800, fontSize: 15, color: "#1a1a1a" }}>{title}</div>
        </div>
      );
    }
    if (ts === "full-width" || isDark) {
      return (
        <div style={{ padding: "6px 20px", margin: "4px 0" }}>
          <div style={{ background: accent, border: `2px solid ${a2}`, borderRadius: 8, color: "white", padding: "12px 24px", textAlign: "center", fontWeight: 800, fontSize: 15 }}>{title}</div>
        </div>
      );
    }
    if (ts === "underlined") {
      return (
        <div style={{ padding: "10px 28px", margin: "4px 0", borderBottom: `2px solid ${accent}`, textAlign: "center", fontWeight: 800, fontSize: 15, color: accent }}>{title}</div>
      );
    }
    if (ts === "badge") {
      return (
        <div style={{ padding: "8px 28px", margin: "4px 0", textAlign: "center" }}>
          <span style={{ background: accent, color: "#fff", padding: "8px 28px", borderRadius: 20, fontWeight: 800, fontSize: 14 }}>{title}</span>
        </div>
      );
    }
    return (
      <div style={{ background: `linear-gradient(135deg, ${titleBg}, ${accent})`, color: "white", padding: "12px 24px", textAlign: "center", fontWeight: 800, fontSize: 15 }}>{title}</div>
    );
  };

  // ═══ Fields ═══
  const renderFields = () => {
    const fields = [
      { label: "الاسم", value: "أحمد محمد" },
      { label: "المدرسة", value: "متوسطة النموذجية" },
      { label: "المعيار / البند", value: "التخطيط للتعليم والتعلم" },
      { label: "المقيّم", value: "محمد عبدالله" },
    ];
    if (fs === "table") {
      return (
        <div style={{ padding: "12px 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: `1.5px solid ${borderColor}` }}>
            <tbody>
              {fields.map((f,i) => (
                <tr key={i}>
                  <td style={{ background: titleBg, color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 12px", width: "30%", border: `1px solid ${borderColor}`, textAlign: "center" }}>{f.label}</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, border: `1px solid ${borderColor}20` }}>{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (fs === "cards") {
      return (
        <div style={{ padding: "12px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {fields.map((f,i) => (
            <div key={i} style={{ background: fieldLabelBg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${borderColor}15` }}>
              <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 600 }}>{f.value}</div>
            </div>
          ))}
        </div>
      );
    }
    if (fs === "underlined") {
      return (
        <div style={{ padding: "12px 24px" }}>
          {fields.map((f,i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${borderColor}20` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: accent, width: 120 }}>{f.label}:</span>
              <span style={{ fontSize: 13, color: "#1a1a1a" }}>{f.value}</span>
            </div>
          ))}
        </div>
      );
    }
    // fieldset (default)
    return (
      <div style={{ padding: "12px 24px" }}>
        {fields.map((f,i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 120, padding: "6px 10px", background: fieldLabelBg, border: `1.5px solid ${borderColor}30`, borderRadius: 4, fontWeight: 700, fontSize: 12, color: accent, textAlign: "center" }}>{f.label}</span>
            <span style={{ flex: 1, padding: "6px 10px", borderBottom: `1px dotted ${borderColor}40`, fontSize: 13 }}>{f.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // ═══ Evidence section ═══
  const renderEvidence = () => (
    <div style={{ padding: "4px 24px 16px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", background: accent, padding: "10px 20px", display: "inline-block", borderRadius: "6px 6px 0 0" }}>الشواهد والأدلة</div>
      <div style={{ border: `2px solid ${borderColor}40`, borderTop: `2.5px solid ${accent}`, borderRadius: "0 6px 6px 6px", padding: 16, minHeight: 60 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {["صورة شاهد 1", "ملف PDF", "QR كود"].map((item, i) => (
            <div key={i} style={{ background: "#f3f4f6", borderRadius: 6, padding: "10px 8px", textAlign: "center", fontSize: 11, color: "#9ca3af", border: "1px dashed #d1d5db" }}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══ Signatures ═══
  const renderSignatures = () => {
    const sigLine = ss === "dotted" ? ".............................." : ss === "lined" ? "______________________" : ss === "boxed" ? "⬜" : ss === "stamped" ? "🔏 ختم رسمي" : "________________________";
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 24px", fontSize: 14, fontWeight: 800, color: accent }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>التنفيذ:</div>
          <div style={{ color: "#1a1a1a", fontWeight: 700 }}>أ/ أحمد</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sigLine}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>مدير المدرسة:</div>
          <div style={{ color: "#1a1a1a", fontWeight: 700 }}>أ/ محمد</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sigLine}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>الختم:</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{ss === "boxed" || ss === "stamped" ? sigLine : "⬜"}</div>
        </div>
      </div>
    );
  };

  // ═══ Footer ═══
  const renderFooter = () => (
    <div style={{ background: footerBg, color: "#fff", fontSize: 11, textAlign: "center", padding: "8px 24px", marginTop: "auto" }}>
      {footerText}
      {t.showBottomBar && <div style={{ height: 4, background: a2, marginTop: 6, borderRadius: 2 }} />}
    </div>
  );

  // ═══ Cover page render ═══
  const renderCover = () => {
    const pageStyle: React.CSSProperties = { width: "210mm", minHeight: "297mm", position: "relative", overflow: "hidden", border: `2px solid ${accent}`, background: "#fff", pageBreakAfter: "always" };

    if (cs === "gradient-center") {
      return (
        <div style={pageStyle}>
          {coverHeader}
          <div style={{ background: headerBg, color: headerText, padding: "3rem 2.5rem", textAlign: "center", position: "relative", overflow: "hidden", minHeight: "calc(297mm - 80px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, rgba(0,0,0,0.1) 100%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 12, pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>{coverContent}</div>
          </div>
        </div>
      );
    }

    if (cs === "split-left") {
      return (
        <div style={pageStyle}>
          {coverHeader}
          <div style={{ display: "flex", minHeight: "calc(297mm - 80px)" }}>
            <div style={{ width: "35%", background: headerBg, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "2rem", color: headerText }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 4, background: `linear-gradient(to bottom, ${a2}, ${accent})`, height: "100%" }} />
              <div style={{ fontSize: "4rem", fontWeight: 900, opacity: 0.15, position: "absolute", top: "3rem", fontFamily: "'Cairo'" }}>SERS</div>
              <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                <div style={{ width: 40, height: 2, background: "rgba(255,255,255,0.3)", margin: "1.5rem auto" }} />
                <div style={{ fontSize: "0.85rem", opacity: 0.8, fontWeight: 600 }}>1446-1447هـ</div>
              </div>
            </div>
            <div style={{ width: "65%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4rem 3rem", color: borderColor }}>
              <h1 style={{ fontSize: "2.2rem", fontWeight: 900, marginBottom: "1rem", color: accent }}>{reportTitle}</h1>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: borderColor, marginBottom: "2rem" }}>{jobTitle}</p>
              <div style={{ width: 60, height: 3, background: accent, marginBottom: "2rem" }} />
              <div style={{ display: "flex", gap: "2rem" }}>
                <div><div style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>الاسم</div><div style={{ fontWeight: 700 }}>أحمد محمد</div></div>
                <div><div style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>المدرسة</div><div style={{ fontWeight: 700 }}>النموذجية</div></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (cs === "diagonal") {
      return (
        <div style={pageStyle}>
          {coverHeader}
          <div style={{ background: headerBg, height: "40%", position: "absolute", top: 80, left: 0, right: 0, clipPath: "polygon(0 0, 100% 0, 100% 75%, 0 100%)" }} />
          <div style={{ position: "relative", zIndex: 1, minHeight: "297mm", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4rem 3rem", textAlign: "center" }}>
            <div style={{ background: "white", borderRadius: 16, padding: "3rem", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", border: `2px solid ${accent}20`, maxWidth: 500, margin: "0 auto" }}>
              <div style={{ width: 60, height: 4, background: `linear-gradient(to left, ${accent}, ${a2})`, margin: "0 auto 1.5rem", borderRadius: 2 }} />
              <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: accent, marginBottom: "0.75rem" }}>{reportTitle}</h1>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: borderColor, marginBottom: "1.5rem" }}>{jobTitle}</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "2rem", fontSize: "0.85rem", color: "#6B7280" }}>
                <div><strong style={{ color: accent }}>أحمد محمد</strong></div>
                <div style={{ color: "#D1D5DB" }}>|</div>
                <div><strong style={{ color: accent }}>النموذجية</strong></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (cs === "framed-elegant") {
      return (
        <div style={pageStyle}>
          {coverHeader}
          <div style={{ minHeight: "calc(297mm - 80px)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "3rem", position: "relative" }}>
            <div style={{ position: "absolute", top: 20, left: 20, right: 20, bottom: 20, border: `2px solid ${accent}`, borderRadius: 8, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 28, left: 28, right: 28, bottom: 28, border: `1px solid ${accent}30`, borderRadius: 6, pointerEvents: "none" }} />
            <div style={{ textAlign: "center", position: "relative", zIndex: 1, color: accent }}>
              <h1 style={{ fontSize: "2.2rem", fontWeight: 900, marginBottom: "1rem" }}>{reportTitle}</h1>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>{jobTitle}</p>
              <div style={{ width: 60, height: 3, background: accent, margin: "1rem auto" }} />
              <div style={{ display: "flex", justifyContent: "center", gap: "3rem", fontSize: "0.9rem", marginTop: "2rem" }}>
                <div><div style={{ fontSize: "0.7rem", opacity: 0.6 }}>الاسم</div><div style={{ fontWeight: 700 }}>أحمد محمد</div></div>
                <div><div style={{ fontSize: "0.7rem", opacity: 0.6 }}>المدرسة</div><div style={{ fontWeight: 700 }}>النموذجية</div></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (cs === "top-bar") {
      return (
        <div style={pageStyle}>
          {coverHeader}
          <div style={{ background: headerBg, padding: "3rem 2.5rem", color: headerText, textAlign: "center" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.5rem" }}>{reportTitle}</h1>
            <p style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.8 }}>{jobTitle}</p>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "4rem 3rem", textAlign: "center", color: accent }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "3rem", fontSize: "0.9rem" }}>
              <div><div style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>الاسم</div><div style={{ fontWeight: 700 }}>أحمد محمد</div></div>
              <div><div style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>المدرسة</div><div style={{ fontWeight: 700 }}>النموذجية</div></div>
            </div>
            <div style={{ marginTop: "3rem", fontSize: "0.7rem", color: "#9CA3AF" }}>نظام SERS — {coverSub}</div>
          </div>
        </div>
      );
    }

    // minimal-line
    return (
      <div style={pageStyle}>
        {coverHeader}
        <div style={{ minHeight: "calc(297mm - 80px)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4rem 3rem", textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: "50%", left: 40, right: 40, height: 1, background: accent, opacity: 0.15 }} />
          <div style={{ position: "relative", zIndex: 1, color: accent }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "0.5rem" }}>{reportTitle}</h1>
            <div style={{ width: 40, height: 2, background: accent, margin: "0.5rem auto" }} />
            <p style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "2rem" }}>{jobTitle}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "2rem", fontSize: "0.85rem", color: "#6B7280" }}>
              <span>أحمد محمد</span><span>·</span><span>النموذجية</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══ Inner page render ═══
  const renderInnerPage = () => (
    <div style={{ width: "210mm", minHeight: "297mm", background: bodyBg, border: `2px solid ${accent}`, display: "flex", flexDirection: "column", position: "relative" }}>
      {t.showTopLine && <div style={{ height: 4, background: accent }} />}
      {renderInnerHeader()}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        {renderTitle()}
        {renderFields()}
        {renderEvidence()}
        {renderSignatures()}
      </div>
      {renderFooter()}
    </div>
  );

  return (
    <div style={{ direction: "rtl", fontFamily: "'Cairo', sans-serif" }}>
      {showCover && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginBottom: 4 }}>صفحة الغلاف — نمط: {cs === "gradient-center" ? "تدرج مركزي" : cs === "split-left" ? "تقسيم يسار" : cs === "diagonal" ? "قطري" : cs === "framed-elegant" ? "إطار أنيق" : cs === "top-bar" ? "شريط علوي" : "بسيط"}</p>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: "210mm" }}>
            {renderCover()}
          </div>
        </div>
      )}
      {showInnerPage && (
        <div>
          <p style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginBottom: 4 }}>الصفحة الداخلية — نمط ترويسة: {hv === "right-text-center-logo-left-info" ? "نص + شعار + معلومات" : "مختصر"} | عنوان: {ts} | حقول: {fs} | توقيع: {ss}</p>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: "210mm" }}>
            {renderInnerPage()}
          </div>
        </div>
      )}
    </div>
  );
}
