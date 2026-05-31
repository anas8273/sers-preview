/**
 * AuthGuard — مكون حماية الصفحات المحمية
 * يتحقق من تسجيل الدخول قبل عرض المحتوى
 * إذا لم يكن مسجلاً → يعيد توجيهه لصفحة تسجيل الدخول
 */
import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  /** تطلب صلاحيات أدمن */
  requireAdmin?: boolean;
  /** مسار إعادة التوجيه عند عدم المصادقة */
  redirectTo?: string;
}

export default function AuthGuard({
  children,
  requireAdmin = false,
  redirectTo = '/login',
}: AuthGuardProps) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]" dir="rtl">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            جاري التحقق من الصلاحيات...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    navigate(redirectTo);
    return null;
  }

  // Admin check (if user object has role)
  if (requireAdmin && (user as any)?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]" dir="rtl">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            غير مصرح
          </h2>
          <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            هذه الصفحة تتطلب صلاحيات مدير النظام
          </p>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
