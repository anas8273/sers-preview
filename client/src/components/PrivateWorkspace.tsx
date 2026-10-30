import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateQueryCache } from "@/lib/private-query-cache";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { onRemoteAuthChange, privateLocalStorage } from "@/lib/private-browser-storage";

export function isPrivateWorkspacePath(path: string) {
  return !(path === "/" || path === "/store" || path === "/404" || /^\/(output|share|exam|shared-template)\//.test(path));
}

function StorageNotice() {
  const [, update] = useState(0);
  useEffect(() => {
    const changed = () => update(n => n + 1);
    window.addEventListener("sers-private-storage-change", changed);
    const leaving = (event: BeforeUnloadEvent) => { if (privateLocalStorage.hasPendingWrites) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", leaving);
    return () => { window.removeEventListener("sers-private-storage-change", changed); window.removeEventListener("beforeunload", leaving); };
  }, []);
  if (!privateLocalStorage.hasWriteError) return <span hidden data-private-storage-pending={String(privateLocalStorage.hasPendingWrites)} />;
  return <div role="alert" data-private-storage-error="true" dir="rtl" className="fixed bottom-0 inset-x-0 z-[100] bg-amber-100 p-4 text-amber-950">تعذر حفظ النسخة المحلية. أبق الصفحة مفتوحة لحماية تعديلاتك. <button className="underline font-bold" onClick={() => void privateLocalStorage.retry().catch(() => {})}>إعادة الحفظ</button></div>;
}

function AuthenticatedWorkspace({ children, required }: { children: ReactNode; required: boolean }) {
  const { user, loading, error, refresh } = useAuth();
  const queryClient = useQueryClient();
  const previousUser = useRef<number | null | undefined>(undefined);
  const [cacheEpoch, setCacheEpoch] = useState(0);
  const [ready, setReady] = useState<number | null>(null);
  const [storageError, setStorageError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setReady(null); setStorageError(""); privateLocalStorage.lock();
    void (async () => {
      // Do not cancel public queries during the first anonymous/auth lookup.
      // Only a previously established account can leave private query data.
      if (typeof previousUser.current === "number" && previousUser.current !== user?.id) {
        await clearPrivateQueryCache(queryClient);
        if (cancelled) return;
        setCacheEpoch(epoch => epoch + 1);
      }
      if (cancelled) return;
      previousUser.current = user?.id ?? null;
      if (!user) return;
      // Fetch outside QueryCache: the raw key must not become cached app state.
      const response = await fetch("/api/trpc/auth.browserStorageKey", { credentials: "include", cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("تعذر فتح مساحة العمل؛ تحقق من الاتصال وسجّل الدخول مجددًا عند الحاجة.");
      const body = await response.json();
      if (cancelled) return;
      await privateLocalStorage.unlock(body.result?.data?.json);
      if (!cancelled) setReady(user.id);
    })().catch(error => { if (!cancelled) setStorageError(error instanceof Error ? error.message : "تعذر فتح مساحة العمل"); });
    return () => { cancelled = true; controller.abort(); privateLocalStorage.lock(); };
  }, [user?.id, attempt, queryClient]);
  if (typeof previousUser.current === "number" && previousUser.current !== user?.id) return <div dir="rtl" className="p-10 text-center">جارٍ تبديل الحساب...</div>;
  if (!required) return <div key={cacheEpoch}>{children}</div>;
  if (loading) return <div dir="rtl" className="p-10 text-center">جارٍ التحقق من الجلسة...</div>;
  if (error) return <div dir="rtl" className="p-10 text-center" role="alert">تعذر التحقق من الجلسة. <button onClick={() => void refresh()} className="underline">إعادة المحاولة</button></div>;
  if (!user) return <main dir="rtl" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-8"><h1 className="text-2xl font-bold">مساحة عملك الخاصة</h1><p>سجّل الدخول للوصول إلى تقاريرك وشواهدك.</p><a href={getLoginUrl()} className="rounded-xl bg-teal-700 px-6 py-3 text-white font-bold">تسجيل الدخول</a></main>;
  if (ready !== user.id) return <div dir="rtl" className="p-10 text-center">{storageError ? <><p role="alert">{storageError}</p><button className="underline" onClick={() => setAttempt(n => n + 1)}>إعادة المحاولة</button> · <a href={getLoginUrl()}>تسجيل الدخول مجددًا</a></> : "جارٍ فتح بياناتك الخاصة..."}</div>;
  return <div key={user.id}><StorageNotice />{children}</div>;
}

export default function PrivateWorkspace({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  useEffect(() => {
    let reloading = false;
    const reset = () => { if (reloading) return; reloading = true; document.documentElement.style.visibility = "hidden"; void privateLocalStorage.prepareLogout().catch(() => {}).finally(() => { privateLocalStorage.lock(); window.location.reload(); }); };
    const off = onRemoteAuthChange(reset);
    const restore = (event: PageTransitionEvent) => { if (event.persisted) reset(); };
    window.addEventListener("pageshow", restore);
    return () => { off(); window.removeEventListener("pageshow", restore); };
  }, []);
  return <AuthenticatedWorkspace required={isPrivateWorkspacePath(path)}>{children}</AuthenticatedWorkspace>;
}
