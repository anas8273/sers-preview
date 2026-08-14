/**
 * i18n — تهيئة الترجمة (العربية والإنجليزية)
 * يستخدم i18next مع react-i18next
 * اللغة الافتراضية: العربية
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ─── Translation Resources ──────────────────────────────
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

// اكتشاف لغة المتصفح أو المحفوظة
function getInitialLanguage(): string {
  try {
    const saved = localStorage.getItem('sers-lang');
    if (saved && ['ar', 'en'].includes(saved)) return saved;
  } catch {}
  // اكتشاف لغة المتصفح
  const browserLang = navigator.language?.split('-')[0];
  return browserLang === 'en' ? 'en' : 'ar';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  });

// تحديث اتجاه الصفحة عند تغيير اللغة
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
  try { localStorage.setItem('sers-lang', lng); } catch {}
});

export default i18n;
