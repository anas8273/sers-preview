/**
 * RegisterPage — صفحة إنشاء حساب جديد
 * ✅ Real tRPC auth.register backend call
 * ✅ Password strength + terms (no social icons — only on login page)
 */
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import {
  GraduationCap, Mail, Lock, Eye, EyeOff, Loader2, UserPlus,
  ArrowRight, User, ShieldCheck, CheckCircle2, Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading, refresh } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const registerMutation = trpc.auth.register.useMutation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="w-8 h-8 border-4 border-teal-200 dark:border-teal-800 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (isAuthenticated) { navigate('/'); return null; }

  const updateField = (key: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('يرجى إدخال الاسم'); return; }
    if (!form.email.trim()) { toast.error('يرجى إدخال البريد الإلكتروني'); return; }
    if (form.password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (form.password !== form.confirm) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    if (!accepted) { toast.error('يرجى الموافقة على شروط الاستخدام'); return; }

    setLoading(true);
    try {
      const result = await registerMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (!result.success) {
        toast.error(result.error || 'فشل إنشاء الحساب');
        setLoading(false);
        return;
      }

      toast.success('تم إنشاء الحساب بنجاح! 🎉', { description: 'جاري التوجيه...' });
      await refresh();
      navigate('/');
    } catch (err: any) {
      toast.error('خطأ في إنشاء الحساب', { description: err.message || 'حاول مرة أخرى' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pr-10 pl-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all";

  const pwStrength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : /[A-Z]/.test(form.password) && /\d/.test(form.password) ? 4 : 3;
  const pwColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-teal-500', 'bg-green-500'];
  const pwLabels = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية جداً'];

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-cyan-700 via-teal-700 to-teal-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-teal-400/20 blur-3xl" style={{ animation: 'float 7s ease-in-out infinite' }} />
        <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-cyan-300/15 blur-3xl" style={{ animation: 'float 5s ease-in-out infinite reverse' }} />
        <div className="relative z-10 text-center text-white max-w-md">
          <div className="w-20 h-20 bg-white/15 backdrop-blur-xl rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl" style={{ animation: 'bounceIn 0.6s ease-out' }}>
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black mb-3" style={{ fontFamily: "'Tajawal', sans-serif", animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>انضم إلى SERS</h1>
          <p className="text-lg text-teal-100 mb-6" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>أنشئ حسابك واستفد من الأدوات التعليمية الذكية</p>
          <div className="space-y-2 text-right" style={{ animation: 'fadeInUp 0.6s ease-out 0.3s both' }}>
            {['حساب مجاني بالكامل', 'حفظ وتصدير غير محدود', 'دعم الذكاء الاصطناعي', 'تحديثات مستمرة'].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-teal-100">
                <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0" /><span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 overflow-y-auto">
        <div className="w-full max-w-[420px] my-4" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <div className="lg:hidden text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xl shadow-teal-500/25">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-3xl shadow-2xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-700/50 p-6 sm:p-8 backdrop-blur-sm" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
            <div className="text-center mb-5">
              <h2 className="text-xl font-black text-gray-900 dark:text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>إنشاء حساب جديد ✨</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">سجّل الآن مجاناً</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-3">
              <div className="group">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>الاسم الكامل</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                  <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="أدخل اسمك الكامل" className={inputClass} autoComplete="name" />
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                  <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="example@email.com" className={inputClass} dir="ltr" autoComplete="email" />
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="6 أحرف على الأقل" className="w-full pr-10 pl-12 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all" dir="ltr" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${pwColors[pwStrength]} rounded-full transition-all duration-300`} style={{ width: `${pwStrength * 25}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{pwLabels[pwStrength]}</span>
                  </div>
                )}
              </div>

              <div className="group">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>تأكيد كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                  <input type="password" value={form.confirm} onChange={(e) => updateField('confirm', e.target.value)} placeholder="أعد كتابة كلمة المرور" className={inputClass} dir="ltr" autoComplete="new-password" />
                  {form.confirm.length > 0 && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      {form.password === form.confirm
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <span className="text-sm text-red-500 font-bold">✗</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input type="checkbox" id="terms" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="w-4 h-4 mt-0.5 rounded border-gray-300 dark:border-gray-600 text-teal-600 focus:ring-teal-500/30 cursor-pointer" />
                <label htmlFor="terms" className="text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer leading-relaxed">
                  أوافق على <span className="text-teal-600 dark:text-teal-400 font-medium">شروط الاستخدام</span> و<span className="text-teal-600 dark:text-teal-400 font-medium">سياسة الخصوصية</span>
                </label>
              </div>

              <Button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-l from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-xl gap-2 text-sm font-bold shadow-lg shadow-teal-600/25 active:scale-[0.98] transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                إنشاء الحساب
              </Button>
            </form>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              لديك حساب بالفعل؟{' '}
              <button onClick={() => navigate('/login')} className="text-teal-600 dark:text-teal-400 hover:text-teal-700 font-bold transition-colors">تسجيل الدخول</button>
            </p>
          </div>

          <button onClick={() => navigate('/')} className="flex items-center justify-center gap-1.5 mx-auto mt-4 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <Home className="w-3.5 h-3.5" />
            العودة للصفحة الرئيسية
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-gray-400 dark:text-gray-500">
            <ShieldCheck className="w-3 h-3" /><span>بياناتك آمنة ومشفّرة</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
      `}</style>
    </div>
  );
}
