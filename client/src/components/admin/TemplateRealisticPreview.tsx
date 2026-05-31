/**
 * TemplateRealisticPreview — معاينة حقيقية مطابقة 100% لما يراه المستخدم
 * نسخة طبق الأصل من render في PerformanceEvidence.tsx (خطوط 3818-4226)
 *
 * ⚠️ أي تعديل هنا يجب أن ينعكس في PerformanceEvidence.tsx والعكس صحيح
 */
import React from 'react';
import { getMoeLogoUrl, getMoeLogoFilter } from '@/components/MoeLogo';

interface DynamicField {
  id: string;
  label: string;
  type?: string;
  value?: string;
}

interface TemplatePreviewProps {
  template: {
    name: string;
    headerBg: string;
    headerText: string;
    accent: string;
    borderColor: string;
    bodyBg?: string;
    templateLayout?: Record<string, any> | null;
    logoUrl?: string;
    coverImageUrl?: string;
  };
  /** Scale is now handled by the iframe parent — keep 1 for pixel-perfect */
  scale?: number;
  /** Dynamic fields from FieldSchemaBuilder — overrides hardcoded sampleFields */
  dynamicFields?: DynamicField[];
}

// ─── Generate realistic mock values per field type ────────
function getMockValue(field: DynamicField): string {
  if (field.value) return field.value;
  const label = (field.label || '').toLowerCase();
  const type = field.type || 'text';
  if (type === 'date') return '١٤٤٦/٠٩/٢٥';
  if (type === 'number') return '95';
  if (type === 'select') return 'الخيار الأول';
  if (type === 'textarea') return `يلتزم المعلم بمواعيد الدوام الرسمي وفقاً للنظام المعتمد من إدارة المدرسة. هذا النص التوضيحي يمثل محتوى ${field.label || 'الحقل'}`;
  // Smart Arabic mock based on label keywords
  if (label.includes('اسم') || label.includes('معلم') || label.includes('طالب')) return 'أ/ محمد أحمد العتيبي';
  if (label.includes('مدرسة')) return 'مدرسة التميز النموذجية';
  if (label.includes('تاريخ')) return '١٤٤٦/٠٩/٢٥';
  if (label.includes('موضوع')) return 'الالتزام بمواعيد الحضور والانصراف';
  if (label.includes('ملاحظ')) return 'نموذج تجريبي — بيانات افتراضية';
  return field.label ? `قيمة ${field.label}` : 'بيانات تجريبية';
}

export default function TemplateRealisticPreview({ template: t, scale = 1, dynamicFields }: TemplatePreviewProps) {
  const layout = t.templateLayout || {};
  const accent = t.accent || '#1a6b6a';
  const borderColor = t.borderColor || '#2ea87a';
  const headerBg = t.headerBg || '#1a6b6a';
  const headerText = t.headerText || '#ffffff';
  const isGradientHeader = headerBg.startsWith('linear-gradient');
  const isDarkHeader = isGradientHeader || (headerBg !== '#ffffff' && headerBg !== '#f8f9fa' && !headerBg.includes('#fff'));
  const fStyle = layout.fieldStyle || 'fieldset';
  const hTextColor = isDarkHeader ? '#ffffff' : (headerText || borderColor || '#1a3a5c');
  const showBottomBar = layout.showBottomBar !== false;
  const showLogo = layout.showMoeLogo !== false;
  const logoSrc = (t as any).logoUrl || getMoeLogoUrl();

  // ─── Title style — مطابق تماماً لـ PerformanceEvidence خطوط 4016-4072 ───
  const titleStyle = layout.titleStyle || 'rounded';
  // ─── Header variant — مطابق تماماً لـ PerformanceEvidence خطوط 3839-4013 ───
  const headerVariant = layout.headerVariant || 'right-text-center-logo-left-info';

  // === بيانات تجريبية — ديناميكية أو ثابتة ===
  const defaultSampleFields = [
    { id: 'subject', label: 'الموضوع', value: 'الالتزام بمواعيد الحضور والانصراف' },
    { id: 'domain', label: 'المجال', value: 'أداء الواجبات الوظيفية' },
    { id: 'desc', label: 'وصف الشاهد', value: 'يلتزم المعلم بمواعيد الدوام الرسمي وفقاً للنظام المعتمد من إدارة المدرسة' },
    { id: 'date', label: 'التاريخ', value: '١٤٤٦/٠٩/٢٥' },
    { id: 'notes', label: 'ملاحظات', value: 'نموذج تجريبي — بيانات افتراضية' },
  ];

  // If dynamic fields provided, generate mock values and use them
  const sampleFields = (dynamicFields && dynamicFields.length > 0)
    ? dynamicFields.map(f => ({ id: f.id, label: f.label || f.id, value: getMockValue(f) }))
    : defaultSampleFields;

  const shortFields = sampleFields.filter(f => f.value.length < 80);
  const longFields = sampleFields.filter(f => f.value.length >= 80);

  // === عنوان الشاهد التجريبي ===
  const sampleTitle = 'شواهد الأداء الوظيفي';

  // === رسم الحقول — نسخة طبق الأصل من PerformanceEvidence.tsx خطوط 3416-3670 ===
  const renderFields = () => {
    if (fStyle === 'cards') {
      return (
        <div style={{ padding: '16px 24px', flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px' }}>
            {sampleFields.map((field, fi) => (
              <div key={field.id} style={{
                flex: field.value.length >= 80 ? '1 1 100%' : '1 1 calc(50% - 6px)',
                background: '#fff', borderRadius: '10px',
                border: `1.5px solid ${borderColor || '#e2e8f0'}`,
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                  color: '#fff', padding: '9px 16px', fontSize: '12.5px',
                  fontWeight: 700, textAlign: 'center', letterSpacing: '0.4px',
                  borderBottom: `1px solid ${accent}`,
                }}>{field.label}</div>
                <div style={{
                  padding: '12px 16px', fontSize: '13.5px', color: '#1e293b',
                  lineHeight: '1.9', whiteSpace: 'pre-wrap' as const, minHeight: '45px',
                  background: fi % 2 === 0 ? '#ffffff' : '#fafbfc',
                }}>{field.value}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (fStyle === 'fieldset') {
      return (
        <div style={{ padding: '16px 24px', flex: 1 }}>
          {sampleFields.map((field, fi) => (
            <div key={field.id} style={{
              border: `1.5px solid ${borderColor || '#e2e8f0'}`,
              borderRadius: '10px', marginBottom: '10px', overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                background: `linear-gradient(90deg, ${accent}, ${accent}ee)`,
                padding: '9px 18px', fontSize: '13px', fontWeight: 700,
                color: '#ffffff', letterSpacing: '0.4px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
                {field.label}
              </div>
              <div style={{
                padding: '12px 18px', fontSize: '13.5px', color: '#1e293b',
                lineHeight: '1.9', whiteSpace: 'pre-wrap' as const, minHeight: '45px',
                background: fi % 2 === 0 ? '#ffffff' : '#fafbfc',
              }}>{field.value}</div>
            </div>
          ))}
        </div>
      );
    }
    if (fStyle === 'underlined') {
      return (
        <div style={{ padding: '16px 24px', flex: 1 }}>
          {sampleFields.map((field, fi) => (
            <div key={field.id} style={{
              borderBottom: `1.5px solid ${borderColor || '#e2e8f0'}`,
              padding: '12px 8px', display: 'flex', gap: '14px',
              alignItems: field.value.length >= 80 ? 'flex-start' : 'center',
              flexDirection: field.value.length >= 80 ? 'column' as const : 'row' as const,
              background: fi % 2 === 0 ? 'transparent' : `${accent}04`,
              borderRadius: '4px',
            }}>
              <div style={{
                fontSize: '13px', fontWeight: 700, color: accent,
                minWidth: '110px', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ width: '3px', height: '14px', borderRadius: '2px', background: accent, opacity: 0.7 }} />
                {field.label}:
              </div>
              <div style={{
                fontSize: '13.5px', color: '#1e293b', lineHeight: '1.9',
                whiteSpace: 'pre-wrap' as const, flex: 1,
              }}>{field.value}</div>
            </div>
          ))}
        </div>
      );
    }
    if (fStyle === 'minimal') {
      return (
        <div style={{ padding: '16px 24px', flex: 1 }}>
          {sampleFields.map((field, fi) => (
            <div key={field.id} style={{ marginBottom: '12px', padding: '4px 0' }}>
              <div style={{
                fontSize: '12px', fontWeight: 700, color: accent,
                letterSpacing: '0.5px', marginBottom: '4px',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <span style={{ width: '6px', height: '2px', borderRadius: '1px', background: accent, opacity: 0.5 }} />
                {field.label}
              </div>
              <div style={{
                fontSize: '13.5px', color: '#1e293b', lineHeight: '1.9',
                whiteSpace: 'pre-wrap' as const, padding: '8px 10px',
                borderBottom: `1.5px dotted ${borderColor || '#e2e8f0'}`,
                borderRight: `2px solid ${accent}20`,
                background: fi % 2 === 0 ? 'transparent' : '#fafbfc',
                borderRadius: '2px',
              }}>{field.value}</div>
            </div>
          ))}
        </div>
      );
    }
    // نمط الجدول الرسمي (table) — نسخة طبق الأصل
    const colsPerRow = 2;
    return (
      <div style={{ padding: '12px 20px', flex: 1, display: 'flex', flexDirection: 'column' as const }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse' as const,
          border: `2px solid ${borderColor || '#b8c9d9'}`,
          flex: 1, tableLayout: 'fixed' as const,
        }}>
          <tbody>
            {(() => {
              const rows: typeof shortFields[] = [];
              for (let i = 0; i < shortFields.length; i += colsPerRow) rows.push(shortFields.slice(i, i + colsPerRow));
              return rows.map((row, ri) => (
                <tr key={`short-${ri}`}>
                  {row.map((field) => (
                    <React.Fragment key={field.id}>
                      <td style={{
                        border: `1.5px solid ${borderColor || '#b8c9d9'}`,
                        padding: '8px 12px', fontWeight: 700, fontSize: '12px', color: '#fff',
                        background: `linear-gradient(135deg, ${accent}, ${headerBg || accent})`,
                        width: '20%', textAlign: 'center', verticalAlign: 'middle', letterSpacing: '0.3px',
                      }}>{field.label}</td>
                      <td style={{
                        border: `1.5px solid ${borderColor || '#b8c9d9'}`,
                        padding: '8px 14px', fontSize: '13px', color: '#1a1a1a',
                        background: ri % 2 === 0 ? '#fff' : '#f8fafb',
                        width: '30%', verticalAlign: 'middle',
                      }}>{field.value}</td>
                    </React.Fragment>
                  ))}
                  {row.length < colsPerRow && Array.from({ length: colsPerRow - row.length }).map((_, i) => (
                    <React.Fragment key={`empty-${i}`}>
                      <td style={{ border: `1.5px solid ${borderColor}`, padding: '8px 12px', background: `linear-gradient(135deg, ${accent}, ${headerBg || accent})`, width: '20%' }}></td>
                      <td style={{ border: `1.5px solid ${borderColor}`, padding: '8px 14px', background: ri % 2 === 0 ? '#fff' : '#f8fafb', width: '30%' }}></td>
                    </React.Fragment>
                  ))}
                </tr>
              ));
            })()}
            {longFields.map((field, fi) => (
              <tr key={field.id}>
                <td style={{
                  border: `1.5px solid ${borderColor || '#b8c9d9'}`,
                  padding: '8px 12px', fontWeight: 700, fontSize: '12px', color: '#fff',
                  background: `linear-gradient(135deg, ${accent}, ${headerBg || accent})`,
                  width: '20%', textAlign: 'center', verticalAlign: 'top', letterSpacing: '0.3px',
                }}>{field.label}</td>
                <td colSpan={colsPerRow * 2 - 1} style={{
                  border: `1.5px solid ${borderColor || '#b8c9d9'}`,
                  padding: '10px 14px', fontSize: '13px', lineHeight: '1.9', color: '#1a1a1a',
                  background: (shortFields.length + fi) % 2 === 0 ? '#fff' : '#f8fafb',
                  whiteSpace: 'pre-wrap' as const, verticalAlign: 'top',
                }}>{field.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // === رسم شريط العنوان — نسخة طبق الأصل من PerformanceEvidence.tsx خطوط 4016-4072 ===
  const renderTitleBar = () => {
    if (titleStyle === 'rounded' && !isDarkHeader) {
      // نمط الإطار المدور التيل الفاتح (مطابق لصفحات 2,3,7,9,10,11 من PDF)
      return (
        <div style={{ padding: '10px 28px', margin: '4px 0' }}>
          <div style={{
            border: '2px solid #8dd4d4',
            borderRadius: '22px',
            padding: '11px 24px',
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '15px',
            color: '#1a1a1a',
            letterSpacing: '0.5px',
          }}>
            {sampleTitle}
          </div>
        </div>
      );
    } else if (titleStyle === 'full-width' || isDarkHeader) {
      // نمط الشريط الكامل مع إطار أخضر (مطابق لصفحات 4,5,6,8 من PDF)
      return (
        <div style={{ padding: '6px 20px', margin: '4px 0' }}>
          <div style={{
            background: '#1a5c5e',
            border: '2px solid #3cc68a',
            borderRadius: '8px',
            color: 'white',
            padding: '12px 24px',
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '15px',
            letterSpacing: '0.5px',
          }}>
            {sampleTitle}
          </div>
        </div>
      );
    } else {
      // نمط بسيط
      return (
        <div style={{
          background: `linear-gradient(135deg, ${accent}, ${accent})`,
          color: 'white',
          padding: '12px 24px',
          textAlign: 'center',
          fontWeight: 800,
          fontSize: '15px',
          letterSpacing: '0.5px',
          margin: '0',
        }}>
          {sampleTitle}
        </div>
      );
    }
  };

  // === رسم الترويسة — دعم جميع الأنماط من PerformanceEvidence.tsx خطوط 3839-4013 ===
  const renderHeader = () => {
    const sampleDept = ['المملكة العربية السعودية', 'وزارة التعليم', 'الإدارة العامة للتعليم بمنطقة'];
    const sampleSchool = 'مدرسة النموذجية';

    if (headerVariant === 'right-text-center-logo-left-info') {
      // نمط 1: كتابة يمين + شعار وسط + معلومات يسار
      return (
        <>
          {!isDarkHeader && <div style={{ height: '5px', background: accent }} />}
          <div style={{ background: isDarkHeader ? headerBg : '#ffffff', padding: isDarkHeader ? '16px 24px 12px' : '18px 24px 14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ width: '35%', verticalAlign: 'middle', textAlign: 'right' as const, padding: '0' }}>
                    {sampleDept.map((line, i) => (
                      <div key={i} style={{ fontSize: '13px', color: hTextColor, fontWeight: 700, lineHeight: '2.0', letterSpacing: '0.3px' }}>{line}</div>
                    ))}
                    <div style={{ fontSize: '13px', color: hTextColor, fontWeight: 700, lineHeight: '2.0' }}>{sampleSchool}</div>
                  </td>
                  <td style={{ width: '2%', verticalAlign: 'middle', textAlign: 'center' as const, padding: '0 4px' }}>
                    <div style={{ width: '2px', height: '55px', background: isDarkHeader ? 'rgba(255,255,255,0.35)' : accent, margin: '0 auto' }} />
                  </td>
                  <td style={{ width: '28%', verticalAlign: 'middle', textAlign: 'center' as const, padding: '0' }}>
                    {showLogo && (
                      <img src={logoSrc} alt="شعار وزارة التعليم" style={{
                        height: '80px', objectFit: 'contain' as const,
                        margin: '0 auto', display: 'block',
                        filter: !(t as any).logoUrl ? getMoeLogoFilter(isDarkHeader) : undefined,
                      }} />
                    )}
                  </td>
                  <td style={{ width: '35%', verticalAlign: 'middle', textAlign: 'left' as const, padding: '0' }}>
                    <div style={{ fontSize: '12px', color: hTextColor, fontWeight: 600, lineHeight: '1.8' }}>الفصل الدراسي: الثاني</div>
                    <div style={{ fontSize: '12px', color: hTextColor, fontWeight: 600, lineHeight: '1.8' }}>العام الدراسي: ١٤٤٦هـ</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (headerVariant === 'right-text-left-logo') {
      // نمط 2: كتابة يمين + شعار يسار
      return (
        <>
          <div style={{ height: '5px', background: accent }} />
          <div style={{ background: '#ffffff', padding: '20px 28px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'middle', textAlign: 'right' as const, padding: '0' }}>
                    {sampleDept.map((line, i) => (
                      <div key={i} style={{ fontSize: '14px', color: headerText || '#1a3a5c', fontWeight: 700, lineHeight: '2.2', letterSpacing: '0.3px' }}>{line}</div>
                    ))}
                    <div style={{ fontSize: '14px', color: headerText || '#1a3a5c', fontWeight: 700, lineHeight: '2.2' }}>{sampleSchool}</div>
                  </td>
                  <td style={{ width: '2%', verticalAlign: 'middle', textAlign: 'center' as const, padding: '0 6px' }}>
                    <div style={{ width: '2px', height: '60px', background: accent, margin: '0 auto' }} />
                  </td>
                  <td style={{ width: '48%', verticalAlign: 'middle', textAlign: 'left' as const, padding: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px' }}>
                      {showLogo && <img src={logoSrc} alt="شعار وزارة التعليم" style={{ height: '85px', objectFit: 'contain' as const }} />}
                    </div>
                    <div style={{ textAlign: 'left', marginTop: '4px' }}>
                      <div style={{ fontSize: '11px', color: headerText || '#1a3a5c', fontWeight: 600, lineHeight: '1.7' }}>الفصل الدراسي: الثاني</div>
                      <div style={{ fontSize: '11px', color: headerText || '#1a3a5c', fontWeight: 600, lineHeight: '1.7' }}>العام الدراسي: ١٤٤٦هـ</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (headerVariant === 'center-logo-banner') {
      // نمط 3: شعار وسط + شريط عنوان
      return (
        <>
          <div style={{ height: '5px', background: accent }} />
          <div style={{ background: '#ffffff', padding: '14px 24px 10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ width: '48%', verticalAlign: 'middle', textAlign: 'right' as const, padding: '0' }}>
                    <div style={{ fontSize: '13px', color: headerText || '#1a3a5c', fontWeight: 700, lineHeight: '2.0' }}>وزارة التعليم</div>
                    {sampleDept.slice(1).map((line, i) => (
                      <div key={i} style={{ fontSize: '12px', color: headerText || '#1a3a5c', fontWeight: 600, lineHeight: '1.9' }}>{line}</div>
                    ))}
                    <div style={{ fontSize: '12px', color: headerText || '#1a3a5c', fontWeight: 600, lineHeight: '1.9' }}>مدرسة: {sampleSchool}</div>
                  </td>
                  <td style={{ width: '2%', verticalAlign: 'middle', textAlign: 'center' as const, padding: '0 4px' }}>
                    <div style={{ width: '2px', height: '55px', background: accent, margin: '0 auto' }} />
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'middle', textAlign: 'left' as const, padding: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px' }}>
                      {showLogo && <img src={logoSrc} alt="شعار وزارة التعليم" style={{ height: '70px', objectFit: 'contain' as const }} />}
                    </div>
                    <div style={{ textAlign: 'left', marginTop: '4px' }}>
                      <div style={{ fontSize: '11px', color: headerText || '#1a3a5c', fontWeight: 600, lineHeight: '1.7' }}>الفصل الدراسي: الثاني</div>
                      <div style={{ fontSize: '11px', color: headerText || '#1a3a5c', fontWeight: 600, lineHeight: '1.7' }}>العام الدراسي: ١٤٤٦هـ</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ height: '4px', background: accent }} />
        </>
      );
    }

    // نمط 4: ترويسة كاملة (full-header-sections) — default
    return (
      <>
        <div style={{ height: '5px', background: accent }} />
        <div style={{ background: '#ffffff', padding: '14px 24px 10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={{ width: '34%', verticalAlign: 'middle', textAlign: 'right' as const, padding: '0' }}>
                  {sampleDept.map((line, i) => (
                    <div key={i} style={{ fontSize: '13px', color: headerText || '#1a3a5c', fontWeight: 700, lineHeight: '2.0' }}>{line}</div>
                  ))}
                  <div style={{ fontSize: '13px', color: headerText || '#1a3a5c', fontWeight: 700, lineHeight: '2.0' }}>{sampleSchool}</div>
                </td>
                <td style={{ width: '2%', verticalAlign: 'middle', textAlign: 'center' as const, padding: '0 4px' }}>
                  <div style={{ width: '2px', height: '55px', background: accent, margin: '0 auto' }} />
                </td>
                <td style={{ width: '28%', verticalAlign: 'middle', textAlign: 'center' as const, padding: '0' }}>
                  {showLogo && <img src={logoSrc} alt="شعار وزارة التعليم" style={{ height: '75px', objectFit: 'contain' as const, margin: '0 auto', display: 'block' }} />}
                </td>
                <td style={{ width: '36%', verticalAlign: 'middle', textAlign: 'left' as const, padding: '0' }}>
                  <div style={{ fontSize: '12px', color: borderColor || accent, fontWeight: 600, lineHeight: '2.0' }}>الفصل الدراسي: الثاني</div>
                  <div style={{ fontSize: '12px', color: borderColor || accent, fontWeight: 600, lineHeight: '2.0' }}>العام الدراسي: ١٤٤٦هـ</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div style={{
      width: 793.7,
      transformOrigin: 'top right',
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      fontFamily: "'Cairo', sans-serif",
      direction: 'rtl',
      // Sub-pixel rendering fixes for scaled borders
      textRendering: 'optimizeLegibility',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    } as React.CSSProperties}>
      <div className="pdf-page" style={{
        background: (t as any).coverImageUrl
          ? `url(${(t as any).coverImageUrl}) center/cover no-repeat`
          : '#ffffff',
        border: `2px solid ${accent}`,
        position: 'relative' as const,
        boxSizing: 'border-box' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        width: '210mm',
        minHeight: '297mm',
      }}>

        {/* ========== المحتوى الرئيسي ========== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0, minHeight: 0 }}>

        {/* ========== الترويسة — مطابقة لجميع أنماط headerVariant ========== */}
        {renderHeader()}

        {/* ========== شريط العنوان — مطابق تماماً لـ titleStyle من PerformanceEvidence ========== */}
        {renderTitleBar()}

        {/* ========== الحقول — مطابقة لجميع أنماط fieldStyle ========== */}
        {renderFields()}

        {/* ========== الشواهد والأدلة ========== */}
        <div style={{ padding: '0 24px 16px', flex: 1 }}>
          <div style={{
            fontSize: '14px', fontWeight: 700, color: '#fff',
            background: accent, padding: '10px 20px',
            display: 'inline-block', borderRadius: '6px 6px 0 0',
          }}>
            الشواهد والأدلة (1)
          </div>
          <div style={{
            border: `2px solid ${borderColor || '#b8c9d9'}`,
            borderTop: `2.5px solid ${accent}`,
            padding: '16px', display: 'flex', justifyContent: 'center',
            gap: '16px', flexWrap: 'wrap' as const, background: '#fafbfc',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '240px', height: '120px',
                border: '2px dashed #d1d5db', borderRadius: '6px',
                background: '#f9fafb', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column' as const, gap: '8px', padding: '16px',
              }}>
                <span style={{ fontSize: '24px' }}>📎</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>ملف مرفق</span>
                <span style={{ fontSize: '9px', color: '#9ca3af' }}>سجل الدخول لرفع الملف وتفعيل الباركود</span>
              </div>
              <div style={{ fontSize: '11px', color: '#444', marginTop: '6px', fontWeight: 600 }}>صورة شاهد مرفقة</div>
            </div>
          </div>
        </div>

        {/* ========== التوقيعات — نسخة طبق الأصل من خط 4187-4203 ========== */}
        <div style={{ padding: '28px 32px 20px', marginTop: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', padding: '0 20px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: accent, marginBottom: '12px' }}>
                    التنفيذ: <span style={{ fontWeight: 700, color: '#1a1a1a' }}>أ/ ..............................</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#555' }}>
                    التوقيع: <span style={{ display: 'inline-block', width: '180px', borderBottom: `2px dotted ${accent}`, verticalAlign: 'middle' }}>&nbsp;</span>
                  </div>
                </td>
                <td style={{ width: '50%', padding: '0 20px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: accent, marginBottom: '12px' }}>
                    مدير المدرسة: <span style={{ fontWeight: 700, color: '#1a1a1a' }}>أ/ ..............................</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#555' }}>
                    التوقيع: <span style={{ display: 'inline-block', width: '180px', borderBottom: `2px dotted ${accent}`, verticalAlign: 'middle' }}>&nbsp;</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        </div>{/* إغلاق المحتوى الرئيسي */}

        {/* ========== الفوتر — نسخة طبق الأصل من خط 4207-4226 ========== */}
        {showBottomBar ? (
          <div data-pe-footer="true" style={{ marginTop: 'auto' }}>
            {/* الشكل المنحني — نفس SVG + vector-effect لعدم تأثر الخط بالتصغير */}
            <svg viewBox="0 0 800 50" preserveAspectRatio="none" style={{ width: '100%', height: '35px', display: 'block' }}>
              <path d="M0,50 L0,35 C150,8 400,2 800,18 L800,50 Z" fill={accent} vectorEffect="non-scaling-stroke" />
            </svg>
            <div style={{
              background: accent,
              padding: '6px 28px 10px',
              fontSize: '11px',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '-1px',
            }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.3px' }}>SERS - نظام السجلات التعليمية الذكي</span>
              <span style={{ opacity: 0.85, fontSize: '10px' }}>صفحة 1</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '0.5rem 2.5rem', borderTop: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#9CA3AF' }}>
            <span>نظام SERS - السجلات التعليمية الذكية</span>
            <span>صفحة 1</span>
          </div>
        )}

      </div>
    </div>
  );
}
