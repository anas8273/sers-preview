import React, { useState } from 'react';
import { X, Eye, Check } from 'lucide-react';

interface ThemeConfig {
  id: string;
  name: string;
  headerBg: string;
  headerText: string;
  titleBg: string;
  accent: string;
  footerBg: string;
  showBottomBar?: boolean;
}

interface TemplatePreviewModalProps {
  isOpen: boolean;
  templates: ThemeConfig[];
  selectedTemplate: ThemeConfig;
  onSelect: (template: ThemeConfig) => void;
  onClose: () => void;
}

/**
 * مكون لعرض معاينة القوالب بشكل احترافي
 * يعرض معاينة فورية للقالب المحدد قبل تطبيقه
 */
export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  isOpen,
  templates,
  selectedTemplate,
  onSelect,
  onClose,
}) => {
  const [previewTemplate, setPreviewTemplate] = useState<ThemeConfig>(selectedTemplate);

  if (!isOpen) return null;

  return (
    <>
      {/* خلفية داكنة */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* النافذة الرئيسية */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
          {/* الرأس */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h2 className="text-2xl font-bold text-foreground">اختر القالب المناسب</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* المحتوى */}
          <div className="flex-1 overflow-hidden flex gap-6 p-6">
            {/* قائمة القوالب - يسار */}
            <div className="w-64 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 pr-4">
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setPreviewTemplate(template)}
                    className={`w-full text-right px-4 py-3 rounded-lg border-2 transition-all ${
                      previewTemplate.id === template.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: template.accent }} />
                      <span className="font-medium text-sm flex-1">{template.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* المعاينة - يمين */}
            <div className="flex-1 overflow-y-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
                {/* معاينة الرأس */}
                <div
                  className="h-24 relative"
                  style={{ background: previewTemplate.headerBg }}
                >
                  <div className="h-full flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-white font-bold text-lg">وزارة التعليم</div>
                      <div className="w-8 h-8 rounded-lg bg-white/20" />
                    </div>
                    <div className="h-1 rounded-full" style={{ background: previewTemplate.accent, width: '60%' }} />
                  </div>
                </div>

                {/* معاينة المحتوى */}
                <div className="p-8 space-y-6">
                  {/* العنوان */}
                  <div>
                    <div
                      className="h-8 rounded-lg mb-2"
                      style={{ background: previewTemplate.titleBg, width: '70%' }}
                    />
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 w-full mb-2" />
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 w-4/5" />
                  </div>

                  {/* محتوى */}
                  <div className="space-y-3">
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 w-5/6" />
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 w-4/5" />
                  </div>

                  {/* التوقيعات */}
                  <div className="flex gap-8 pt-4">
                    <div className="flex-1">
                      <div className="h-12 border-t border-gray-400 mb-2" />
                      <div className="text-xs text-gray-600 dark:text-gray-400">التاريخ</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-12 border-t border-gray-400 mb-2" />
                      <div className="text-xs text-gray-600 dark:text-gray-400">التوقيع</div>
                    </div>
                  </div>
                </div>

                {/* الرقم التسلسلي */}
                <div
                  className="h-12 flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: previewTemplate.footerBg }}
                >
                  نظام السجلات التعليمية الذكي - SERS
                </div>
              </div>
            </div>
          </div>

          {/* التذييل */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-foreground hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              إلغاء
            </button>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">معاينة فورية</span>
            </div>
            <button
              onClick={() => {
                onSelect(previewTemplate);
                onClose();
              }}
              className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              تطبيق القالب
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
