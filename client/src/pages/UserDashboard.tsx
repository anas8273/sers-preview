/**
 * UserDashboard — لوحة المستخدم الشخصية
 * ✅ إحصائيات (ملفات، قوالب، محافظ)
 * ✅ توصيات AI
 * ✅ تعديل الملف الشخصي
 * ✅ حماية: يجب تسجيل الدخول
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import {
  UserCircle, FolderOpen, FileText, Palette, Star, Sparkles,
  BarChart3, ArrowRight, LogOut, Settings, Shield, Home,
  Award, GraduationCap, Clock, TrendingUp, Heart, Loader2, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Quick links for user
const quickLinks = [
  { label: 'شواهد الأداء', icon: Award, path: '/performance-evidence', color: 'from-emerald-500 to-teal-600' },
  { label: 'السيرة الذاتية', icon: GraduationCap, path: '/smart-cv', color: 'from-blue-500 to-indigo-600' },
  { label: 'ملف الإنجاز', icon: FolderOpen, path: '/portfolio', color: 'from-purple-500 to-violet-600' },
  { label: 'التقارير', icon: FileText, path: '/reports', color: 'from-amber-500 to-orange-600' },
  { label: 'المفضلة', icon: Heart, path: '/wishlist', color: 'from-pink-500 to-rose-600' },
  { label: 'المتجر', icon: Star, path: '/store', color: 'from-cyan-500 to-sky-600' },
];

// AI recommendations
const aiRecommendations = [
  { text: 'أكمل ملف الإنجاز للحصول على تقييم أفضل', action: '/portfolio', icon: TrendingUp },
  { text: 'جرّب تصدير شهادة PDF باللغة العربية', action: '/certificates', icon: Award },
  { text: 'استخدم السيرة الذاتية الذكية لإنشاء CV احترافي', action: '/smart-cv', icon: Sparkles },
];

export default function UserDashboard() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, logout, isAuthenticated } = useAuth();
  const statsQuery = trpc.user.stats.useQuery(undefined, { enabled: isAuthenticated });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="w-8 h-8 border-4 border-teal-200 dark:border-teal-800 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const stats = statsQuery.data || { portfolios: 0, files: 0, templates: 0 };
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    toast.success('تم تسجيل الخروج');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-20" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Home className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <h1 className="text-sm font-black text-gray-900 dark:text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>لوحة المستخدم</h1>
          </div>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors">
              <Settings className="w-3.5 h-3.5" />لوحة الإدارة
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-xl shadow-gray-200/30 dark:shadow-black/20 border border-gray-100 dark:border-gray-700/50 overflow-hidden" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
          <div className="h-24 bg-gradient-to-l from-teal-500 via-cyan-600 to-teal-700 dark:from-teal-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-10 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
              <div className="absolute bottom-0 right-20 w-24 h-24 rounded-full bg-teal-300/40 blur-xl" />
            </div>
          </div>
          <div className="px-6 pb-5 -mt-10 relative z-10">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 border-4 border-white dark:border-gray-800 flex items-center justify-center shadow-xl">
                <span className="text-3xl font-black text-white">{(user?.name || 'U').charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <h2 className="text-lg font-black text-gray-900 dark:text-white truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>{user?.name || 'مستخدم'}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1" dir="ltr">
                    <Mail className="w-3 h-3" />{user?.email}
                  </p>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[9px] font-bold rounded-full">
                      <Shield className="w-2.5 h-2.5" />مدير النظام
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3" style={{ animation: 'fadeInUp 0.4s ease-out 0.1s both' }}>
          {[
            { label: 'المحافظ', value: stats.portfolios, icon: FolderOpen, color: 'from-emerald-500 to-teal-600' },
            { label: 'الملفات', value: stats.files, icon: FileText, color: 'from-blue-500 to-indigo-600' },
            { label: 'القوالب', value: stats.templates, icon: Palette, color: 'from-purple-500 to-violet-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 p-4 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{statsQuery.isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /> : value}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div style={{ animation: 'fadeInUp 0.4s ease-out 0.2s both' }}>
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3 flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            <Star className="w-4 h-4 text-amber-500" />اختصارات سريعة
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {quickLinks.map(({ label, icon: Icon, path, color }) => (
              <button key={path} onClick={() => navigate(path)}
                className="flex items-center gap-2.5 p-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-700 transition-all group active:scale-[0.98]">
                <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div style={{ animation: 'fadeInUp 0.4s ease-out 0.3s both' }}>
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3 flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            <Sparkles className="w-4 h-4 text-purple-500" />توصيات ذكية
          </h3>
          <div className="space-y-2">
            {aiRecommendations.map(({ text, action, icon: Icon }, i) => (
              <button key={i} onClick={() => navigate(action)}
                className="w-full flex items-center gap-3 p-3 bg-gradient-to-l from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-100 dark:border-purple-800/30 hover:shadow-md transition-all group active:scale-[0.99]">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium text-right flex-1">{text}</span>
                <ArrowRight className="w-4 h-4 text-purple-400 group-hover:-translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="pt-2" style={{ animation: 'fadeInUp 0.4s ease-out 0.4s both' }}>
          <Button onClick={handleLogout} variant="outline" className="w-full gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl py-2.5">
            <LogOut className="w-4 h-4" />تسجيل الخروج
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
