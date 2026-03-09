/**
 * مكون الترويسة الرسمية - مطابق لتصميم edu-forms.com
 * يُستخدم في المعاينة المفردة وصفحات التقييم النهائي
 */
import React from "react";

interface OfficialHeaderProps {
  deptLines: string[];
  schoolName?: string;
  logoUrl: string;
  /** compact = ترويسة مصغرة للصفحات الداخلية */
  variant?: "full" | "compact";
  /** عنوان الصفحة (يظهر في الشريط تحت الترويسة) */
  pageTitle?: string;
  /** لون الشريط */
  accentColor?: string;
}

const MOE_LOGO_DEFAULT = "https://d2xsxph8kpxj0f.cloudfront.net/310519663047121386/h34s4aPNVyHXdtjgZ7eNNf/UntiTtled-1-1568x1192_bfb97198.png";

export function OfficialHeader({
  deptLines,
  schoolName,
  logoUrl = MOE_LOGO_DEFAULT,
  variant = "full",
  pageTitle,
  accentColor = "#0097A7",
}: OfficialHeaderProps) {
  if (variant === "compact") {
    return (
      <div style={{ marginBottom: "1rem" }}>
        {/* ترويسة مصغرة للصفحات الداخلية */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #1a4d4e 0%, #0d5f61 50%, #0d7377 100%)",
            padding: "10px 20px 8px",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse" as const }}
          >
            <tbody>
              <tr>
                {/* بيانات الجهة */}
                <td
                  style={{
                    width: "45%",
                    verticalAlign: "middle",
                    textAlign: "right",
                    padding: "0",
                  }}
                >
                  {deptLines.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "10px",
                        color: "#ffffff",
                        fontWeight: 600,
                        lineHeight: "1.8",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </td>

                {/* خط فاصل */}
                <td
                  style={{
                    width: "2%",
                    verticalAlign: "middle",
                    textAlign: "center",
                    padding: "0 6px",
                  }}
                >
                  <div
                    style={{
                      width: "1px",
                      height: "40px",
                      background: "rgba(255,255,255,0.35)",
                      margin: "0 auto",
                    }}
                  />
                </td>

                {/* الشعار */}
                <td
                  style={{
                    width: "53%",
                    verticalAlign: "middle",
                    textAlign: "center",
                    padding: "0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt="شعار وزارة التعليم"
                      style={{
                        height: "38px",
                        objectFit: "contain" as const,
                        display: "inline-block",
                        filter: "brightness(0) invert(1)",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />

                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* شريط اسم المدرسة */}
        {schoolName && (
          <div
            style={{
              background: "linear-gradient(to left, #0d7377, #0f8a6e, #2ea87a)",
              color: "white",
              padding: "5px 16px",
              textAlign: "center",
              fontWeight: 700,
              fontSize: "10px",
              letterSpacing: "0.3px",
              borderRadius: "0 0 6px 6px",
              margin: "0 16px",
            }}
          >
            {schoolName}
          </div>
        )}

        {/* شريط العنوان */}
        {pageTitle && (
          <div
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              color: "white",
              padding: "5px 16px",
              textAlign: "center",
              fontWeight: 700,
              fontSize: "11px",
              letterSpacing: "0.3px",
              margin: "4px 0 0",
            }}
          >
            {pageTitle}
          </div>
        )}
      </div>
    );
  }

  // variant === "full" - الترويسة الكاملة للمعاينة المفردة
  return (
    <div>
      <div
        style={{
          background:
            "linear-gradient(135deg, #1a4d4e 0%, #0d5f61 50%, #0d7377 100%)",
          padding: "16px 24px 14px",
          borderRadius: "0 0 12px 12px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <tbody>
            <tr>
              {/* بيانات الجهة */}
              <td
                style={{
                  width: "45%",
                  verticalAlign: "middle",
                  textAlign: "right",
                  padding: "0",
                }}
              >
                {deptLines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "12px",
                      color: "#ffffff",
                      fontWeight: 600,
                      lineHeight: "2",
                    }}
                  >
                    {line}
                  </div>
                ))}
                {schoolName && deptLines.length === 0 && (
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "12px",
                      color: "#ffffff",
                      lineHeight: "2",
                    }}
                  >
                    {schoolName}
                  </div>
                )}
              </td>

              {/* خط فاصل */}
              <td
                style={{
                  width: "2%",
                  verticalAlign: "middle",
                  textAlign: "center",
                  padding: "0 8px",
                }}
              >
                <div
                  style={{
                    width: "1.5px",
                    height: "60px",
                    background: "rgba(255,255,255,0.4)",
                    margin: "0 auto",
                  }}
                />
              </td>

              {/* الشعار */}
              <td
                style={{
                  width: "53%",
                  verticalAlign: "middle",
                  textAlign: "center",
                  padding: "0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                  }}
                >
                  <img
                    src={logoUrl}
                    alt="شعار وزارة التعليم"
                    style={{
                      height: "55px",
                      objectFit: "contain" as const,
                      display: "inline-block",
                      filter: "brightness(0) invert(1)",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />

                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* شريط اسم المدرسة */}
      {schoolName && (
        <div
          style={{
            background: "linear-gradient(to left, #0d7377, #0f8a6e, #2ea87a)",
            color: "white",
            padding: "8px 24px",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "13px",
            letterSpacing: "0.5px",
            borderRadius: "0 0 8px 8px",
            margin: "0 20px",
          }}
        >
          {schoolName}
        </div>
      )}

      {/* شريط العنوان */}
      {pageTitle && (
        <div
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
            color: "white",
            padding: "8px 20px",
            textAlign: "center",
            fontWeight: 800,
            fontSize: "13px",
            letterSpacing: "0.5px",
            margin: "8px 0 0",
          }}
        >
          {pageTitle}
        </div>
      )}
    </div>
  );
}

export default OfficialHeader;
