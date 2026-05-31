/**
 * LanguageSwitcher — زر تبديل اللغة (AR/EN)
 * يتكامل مع i18n ويحفظ الاختيار في localStorage
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  /** حجم الزر */
  size?: 'sm' | 'md';
  /** CSS class */
  className?: string;
  /** عرض النص بجانب الأيقونة */
  showLabel?: boolean;
}

export default function LanguageSwitcher({
  size = 'md',
  className = '',
  showLabel = true,
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const toggleLanguage = () => {
    const newLang = isArabic ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';

  return (
    <button
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 ${padding} rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-colors ${className}`}
      title={t('language.switch')}
    >
      <Globe className={iconSize} />
      {showLabel && (
        <span className={`${textSize} font-medium`}>
          {isArabic ? 'EN' : 'عربي'}
        </span>
      )}
    </button>
  );
}
