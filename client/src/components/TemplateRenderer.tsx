/**
 * TemplateRenderer - محرك عرض القوالب الديناميكية
 * يقرأ بنية JSON (TemplateLayout) ويولد الحقول والأقسام تلقائياً
 * ✅ يدعم وضعين: templateLayout (structured) و canvasData (visual builder)
 */
import React, { useMemo } from 'react';
import { generateQRDataURL } from '@/lib/qr-utils';
import type { TemplateLayout, TemplateField, CanvasElement, TemplateSchema } from '@shared/template-types';
import { DYNAMIC_FIELDS, A4_WIDTH_PX, A4_HEIGHT_PX } from '@shared/template-types';

// ─── Legacy Types (kept for backward compat) ─────────────
interface ThemeColors {
  headerBg: string;
  headerText: string;
  accent: string;
  borderColor: string;
  bodyBg: string;
  fontFamily?: string;
}

/* ═══════════════ CANVAS DATA RENDERER ═══════════════ */
/** Renders a template from canvasData (visual builder output) */
export function CanvasDataRenderer({
  canvasData,
  fieldValues = {},
  scale = 1,
  className = "",
}: {
  canvasData: TemplateSchema;
  fieldValues?: Record<string, string>;
  scale?: number;
  className?: string;
}) {
  const { canvas, elements } = canvasData;

  // Memoize QR data URLs to avoid regeneration on every render
  const qrCache = useMemo(() => {
    const cache = new Map<string, string>();
    for (const el of elements) {
      if (el.type === "qrcode" && el.props.qrData) {
        const key = `${el.props.qrData}-${el.props.qrSize || 4}`;
        if (!cache.has(key)) {
          cache.set(key, generateQRDataURL(el.props.qrData, el.props.qrSize || 4));
        }
      }
    }
    return cache;
  }, [elements]);

  // Memoize sorted elements to avoid re-sorting on every render
  const sortedElements = useMemo(() => [...elements].sort((a, b) => a.zIndex - b.zIndex), [elements]);

  const resolveBinding = (el: CanvasElement): string => {
    if (el.props.binding?.type === "dynamic" && el.props.binding.fieldId) {
      return fieldValues[el.props.binding.fieldId] || `{{${el.props.binding.fieldId}}}`;
    }
    return el.props.content || "";
  };

  const renderCanvasElement = (el: CanvasElement) => {
    if (!el.visible) return null;
    const pr = el.props;
    const style: React.CSSProperties = {
      position: "absolute", left: el.position.x, top: el.position.y,
      width: el.size.width, height: el.size.height,
      zIndex: el.zIndex, opacity: pr.opacity ?? 1,
    };

    if (el.type === "shape" || el.type === "divider") {
      return <div key={el.id} style={{ ...style, background: pr.bgColor || "transparent", borderRadius: pr.borderRadius || 0, border: pr.borderWidth ? `${pr.borderWidth}px solid ${pr.borderColor || "#ccc"}` : undefined }} />;
    }
    if (el.type === "logo") {
      return <div key={el.id} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}><img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663047121386/h34s4aPNVyHXdtjgZ7eNNf/moe-logo-full-5dJWYAGdHPGBpxKkQZFPkP.png" alt="شعار" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} /></div>;
    }
    if (el.type === "image") {
      return <div key={el.id} style={style}>{pr.src ? <img src={pr.src} alt="" style={{ width: "100%", height: "100%", objectFit: (pr.objectFit as any) || "cover", borderRadius: pr.borderRadius }} /> : <div style={{ width: "100%", height: "100%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9ca3af" }}>📷</div>}</div>;
    }
    if (el.type === "qrcode") {
      const qrUrl = qrCache.get(`${pr.qrData}-${pr.qrSize || 4}`) || "";
      return <div key={el.id} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: pr.borderRadius || 4, border: `1px solid ${pr.borderColor || "#e5e7eb"}`, padding: 4 }}>{qrUrl && <img src={qrUrl} alt="QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}</div>;
    }
    if (el.type === "dynamic-field") {
      const dynField = DYNAMIC_FIELDS.find(f => f.id === pr.binding?.fieldId);
      const value = resolveBinding(el);
      return (
        <div key={el.id} style={{ ...style, display: "flex", gap: 6, alignItems: "center", fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif` }}>
          <span style={{ padding: "4px 10px", background: pr.bgColor || "#f0fdf4", border: `1.5px solid ${pr.borderColor || "#1a6b6a30"}`, borderRadius: pr.borderRadius || 4, fontWeight: 700, fontSize: pr.fontSize || 13, color: pr.color || "#1a6b6a", whiteSpace: "nowrap" }}>{pr.content}</span>
          <span style={{ flex: 1, padding: "4px 8px", borderBottom: `1px dotted ${pr.borderColor || "#ccc"}`, fontSize: 13, color: "#1a1a1a" }}>{value}</span>
        </div>
      );
    }
    if (el.type === "table" || el.type === "repeater-table") {
      const rows = pr.rows || 3, cols = pr.cols || 3;
      return (
        <div key={el.id} style={style}>
          <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: pr.fontSize || 12, fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif`, color: pr.color || "#374151" }}>
            <tbody>{Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>{Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "center", fontWeight: r === 0 ? 700 : 400 }}>{r === 0 ? `عمود ${c + 1}` : ""}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
      );
    }
    // text
    return (
      <div key={el.id} style={{
        ...style, color: pr.color || "#1a1a1a", fontSize: pr.fontSize || 14,
        fontWeight: pr.fontWeight || 400, fontStyle: pr.fontStyle || "normal",
        textAlign: (pr.textAlign as any) || "right", lineHeight: pr.lineHeight || 1.6,
        background: pr.bgColor || "transparent", fontFamily: `'${pr.fontFamily || "Cairo"}', sans-serif`,
        borderRadius: pr.borderRadius || 0, padding: pr.padding || 0,
        border: pr.borderWidth ? `${pr.borderWidth}px solid ${pr.borderColor || "#ccc"}` : "none",
        whiteSpace: "pre-wrap", overflow: "hidden",
      }}>{pr.content}</div>
    );
  };

  return (
    <div className={className} style={{
      width: canvas.width || A4_WIDTH_PX, height: canvas.height || A4_HEIGHT_PX,
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      transformOrigin: "top center",
      background: canvas.bgImage ? `url(${canvas.bgImage}) center/cover no-repeat` : (canvas.bgColor || "#fff"),
      position: "relative", fontFamily: "'Cairo', sans-serif", overflow: "hidden",
    }}>
      {sortedElements.map(renderCanvasElement)}
    </div>
  );
}

interface EvidenceItem {
  id: string;
  type: 'image' | 'link' | 'file' | 'video';
  fileName: string;
  fileData?: string;
  link?: string;
  displayAs?: 'image' | 'qr';
}

interface PersonalInfo {
  name?: string;
  school?: string;
  department?: string;
  educationOffice?: string;
  region?: string;
  evaluator?: string;
  customLogo?: string;
  [key: string]: string | undefined;
}

interface TemplateRendererProps {
  layout: TemplateLayout;
  theme: ThemeColors;
  personalInfo: PersonalInfo;
  fieldValues: Record<string, string | string[]>;
  evidences?: EvidenceItem[];
  moeLogo?: string;
  jobTitle?: string;
}

// ─── MOE Logo Default ────────────────────────────────────
const DEFAULT_MOE_LOGO = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663047121386/h34s4aPNVyHXdtjgZ7eNNf/moe-logo-full-5dJWYAGdHPGBpxKkQZFPkP.png';

// ─── Helper: Render field value ──────────────────────────
function renderFieldValue(field: TemplateField, value: string | string[] | undefined, theme: ThemeColors) {
  if (field.type === 'list') {
    const items = Array.isArray(value) ? value : (typeof value === 'string' ? value.split('\n').filter(Boolean) : []);
    if (items.length === 0) return <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>لا توجد بيانات</div>;
    return (
      <div style={{ fontSize: '11px', color: '#333', lineHeight: '1.8' }}>
        {items.map((item, i) => (
          <div key={i} style={{ paddingRight: '4px' }}>
            {i + 1}. {item}
          </div>
        ))}
      </div>
    );
  }

  const displayValue = typeof value === 'string' ? value : (Array.isArray(value) ? value.join(', ') : '');
  if (!displayValue) return <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>—</div>;
  
  if (field.type === 'textarea') {
    return <div style={{ fontSize: '11px', color: '#333', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{displayValue}</div>;
  }

  return <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: '500' }}>{displayValue}</div>;
}

// ─── Main Component ──────────────────────────────────────
export default function TemplateRenderer({
  layout,
  theme,
  personalInfo,
  fieldValues,
  evidences = [],
  moeLogo = DEFAULT_MOE_LOGO,
  jobTitle,
}: TemplateRendererProps) {
  const dir = layout.direction || 'rtl';

  return (
    <div
      dir={dir}
      style={{
        fontFamily: theme.fontFamily || "'Cairo', 'Tajawal', sans-serif",
        background: theme.bodyBg || '#ffffff',
        maxWidth: layout.pageSize === 'letter' ? '816px' : '794px',
        margin: '0 auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* ═══ Header ═══ */}
      <div
        style={{
          background: theme.headerBg,
          padding: layout.headerStyle === 'minimal' ? '16px 24px' : '20px 30px',
          color: theme.headerText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Right side: MOE logo + text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {layout.showMoeLogo !== false && (
            <img src={moeLogo} alt="وزارة التعليم" style={{ height: '55px', objectFit: 'contain' }} />
          )}
          <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
            <div>الإدارة العامة للتعليم</div>
            <div>بالمنطقة {personalInfo.region || ''}</div>
            <div>{personalInfo.school || 'مدرسة'}</div>
          </div>
        </div>

        {/* Left side: School logo */}
        {layout.showSchoolLogo !== false && personalInfo.customLogo && (
          <img src={personalInfo.customLogo} alt="شعار المدرسة" style={{ height: '50px', objectFit: 'contain', borderRadius: '6px' }} />
        )}
      </div>

      {/* ═══ Accent line ═══ */}
      <div style={{ height: '4px', background: `linear-gradient(to left, ${theme.accent}, ${theme.borderColor}, ${theme.accent})` }} />

      {/* ═══ Body ═══ */}
      <div style={{ padding: '24px 28px' }}>
        {layout.sections.map((section) => (
          <div key={section.id} style={{ marginBottom: '20px' }}>
            {/* Section title */}
            <div
              style={{
                background: section.titleBg || `linear-gradient(135deg, ${theme.accent}, ${theme.accent}dd)`,
                color: 'white',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '13px',
                textAlign: 'center',
                marginBottom: '12px',
              }}
            >
              {section.title}
            </div>

            {/* Section fields */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: (section.columns || 1) === 2 ? '1fr 1fr' : '1fr',
                gap: '10px',
              }}
            >
              {section.fields.map((field) => {
                const value = fieldValues[field.id];
                const isFullWidth = field.type === 'textarea' || field.type === 'list' || field.gridColumn;

                return (
                  <div
                    key={field.id}
                    style={{
                      border: `1.5px solid ${theme.accent}30`,
                      borderRadius: '8px',
                      padding: '10px 14px',
                      background: `${theme.accent}04`,
                      gridColumn: isFullWidth && (section.columns || 1) === 2 ? '1 / -1' : undefined,
                    }}
                  >
                    {/* Field label */}
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: theme.accent,
                        marginBottom: '6px',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          background: theme.accent,
                          color: 'white',
                          padding: '2px 10px',
                          borderRadius: '4px',
                          fontSize: '10px',
                        }}
                      >
                        {field.label}:
                      </span>
                    </div>

                    {/* Field value */}
                    {renderFieldValue(field, value, theme)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ═══ Evidence Section ═══ */}
        {layout.showEvidenceSection !== false && evidences.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}dd)`,
                color: 'white',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '13px',
                textAlign: 'center',
                marginBottom: '12px',
              }}
            >
              الشواهد
            </div>
            <div
              style={{
                border: `1.5px solid ${theme.accent}30`,
                borderRadius: '10px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: evidences.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                gap: '12px',
                background: `${theme.accent}04`,
              }}
            >
              {evidences.map((ev) => {
                // Links → always QR
                if (ev.type === 'link') {
                  return (
                    <div key={ev.id} style={{ border: '1px solid #E8E8E8', borderRadius: '8px', padding: '12px', textAlign: 'center', background: '#FAFAFA' }}>
                      <img src={generateQRDataURL(ev.link || '', 5)} alt="QR" style={{ width: '100px', height: '100px', margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '9px', color: '#666', wordBreak: 'break-all', maxHeight: '30px', overflow: 'hidden' }}>{ev.link}</div>
                    </div>
                  );
                }
                // Files/Videos → always QR
                if (ev.type === 'file' || ev.type === 'video') {
                  const qrData = ev.fileData?.startsWith('idb://') ? ev.fileName : (ev.fileData || ev.fileName);
                  return (
                    <div key={ev.id} style={{ border: '1px solid #E8E8E8', borderRadius: '8px', padding: '12px', textAlign: 'center', background: '#FAFAFA' }}>
                      <img src={generateQRDataURL(qrData.substring(0, 200), 5)} alt="QR" style={{ width: '100px', height: '100px', margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold' }}>{ev.fileName}</div>
                    </div>
                  );
                }
                // Images → based on displayAs
                if (ev.displayAs === 'qr') {
                  const qrData = ev.fileData?.startsWith('idb://') ? ev.fileName : (ev.fileData || ev.fileName);
                  return (
                    <div key={ev.id} style={{ border: '1px solid #E8E8E8', borderRadius: '8px', padding: '12px', textAlign: 'center', background: '#FAFAFA' }}>
                      <img src={generateQRDataURL(qrData.substring(0, 200), 5)} alt="QR" style={{ width: '100px', height: '100px', margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '9px', color: '#666' }}>{ev.fileName}</div>
                    </div>
                  );
                }
                // Regular image
                return (
                  <div key={ev.id} style={{ border: '1px solid #E8E8E8', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src={ev.fileData?.startsWith('idb://') ? '' : (ev.fileData || '')} alt={ev.fileName} style={{ width: '100%', height: 'auto', maxHeight: '220px', objectFit: 'contain' }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Signatures ═══ */}
        {layout.signatureLabels && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
            <div>
              <div style={{ background: theme.accent, color: 'white', padding: '8px 16px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>
                {layout.signatureLabels.right.split('/')[0]}
              </div>
              <div style={{ border: `1.5px solid ${theme.accent}35`, borderRadius: '10px', padding: '14px', textAlign: 'center', background: `${theme.accent}04` }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a1a1a' }}>{personalInfo.name || layout.signatureLabels.right.split('/')[1]?.trim() || ''}</div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>{jobTitle || ''}</div>
                <div style={{ width: '80px', borderBottom: '1.5px dotted #999', margin: '8px auto 0' }} />
              </div>
            </div>
            <div>
              <div style={{ background: theme.accent, color: 'white', padding: '8px 16px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>
                {layout.signatureLabels.left.split('/')[0]}
              </div>
              <div style={{ border: `1.5px solid ${theme.accent}35`, borderRadius: '10px', padding: '14px', textAlign: 'center', background: `${theme.accent}04` }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a1a1a' }}>{personalInfo.evaluator || layout.signatureLabels.left.split('/')[1]?.trim() || ''}</div>
                <div style={{ width: '80px', borderBottom: '1.5px dotted #999', margin: '8px auto 0' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Footer ═══ */}
      <div style={{ height: '4px', background: `linear-gradient(to left, ${theme.accent}, ${theme.borderColor}, ${theme.accent})` }} />
      <div
        style={{
          background: theme.headerBg.includes('gradient') ? theme.headerBg : theme.accent,
          padding: '10px 20px',
          textAlign: 'center',
          color: theme.headerText,
          fontSize: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{layout.footerText || 'SERS - نظام السجلات التعليمية الذكي'}</span>
        <span style={{ opacity: 0.7 }}>صفحة 1</span>
      </div>
    </div>
  );
}

// ─── Template Form Generator ─────────────────────────────
// Generates input form from TemplateLayout for data entry
interface TemplateFormProps {
  layout: TemplateLayout;
  theme: ThemeColors;
  values: Record<string, string | string[]>;
  onChange: (fieldId: string, value: string | string[]) => void;
}

export function TemplateForm({ layout, theme, values, onChange }: TemplateFormProps) {
  return (
    <div dir={layout.direction || 'rtl'} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {layout.sections.map((section) => (
        <div key={section.id} style={{ border: `1px solid ${theme.accent}20`, borderRadius: '12px', overflow: 'hidden' }}>
          <div
            style={{
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
              color: 'white',
              padding: '10px 16px',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            {section.title}
          </div>
          <div
            style={{
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: (section.columns || 1) === 2 ? '1fr 1fr' : '1fr',
              gap: '12px',
            }}
          >
            {section.fields.map((field) => {
              const value = values[field.id] || (field.type === 'list' ? [] : '');
              const isFullWidth = field.type === 'textarea' || field.type === 'list';

              return (
                <div
                  key={field.id}
                  style={{
                    gridColumn: isFullWidth && (section.columns || 1) === 2 ? '1 / -1' : undefined,
                  }}
                >
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
                    {field.label}
                    {field.required && <span style={{ color: '#ef4444', marginRight: '4px' }}>*</span>}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      placeholder={field.placeholder || field.label}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${theme.accent}30`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  ) : field.type === 'list' ? (
                    <textarea
                      value={Array.isArray(value) ? value.join('\n') : (typeof value === 'string' ? value : '')}
                      onChange={(e) => onChange(field.id, e.target.value.split('\n'))}
                      placeholder="أدخل كل عنصر في سطر جديد"
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${theme.accent}30`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${theme.accent}30`,
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                    >
                      <option value="">اختر...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'date' ? 'text' : field.type === 'number' ? 'number' : 'text'}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      placeholder={field.placeholder || field.label}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${theme.accent}30`,
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
