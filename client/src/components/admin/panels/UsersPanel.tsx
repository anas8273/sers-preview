import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Search, Users, ShieldCheck, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function UsersPanel() {
  const { data: usersList, isLoading, refetch } = trpc.admin.users.useQuery();
  const updateRoleMutation = trpc.admin.updateRole.useMutation({ onSuccess: () => { refetch(); toast.success("تم تحديث الصلاحية"); } });
  const deleteMutation = trpc.admin.deleteUser.useMutation({ onSuccess: () => { refetch(); toast.success("تم حذف المستخدم"); } });
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!usersList) return [];
    if (!searchQuery.trim()) return usersList;
    const q = searchQuery.toLowerCase();
    return usersList.filter((u: any) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  }, [usersList, searchQuery]);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>إدارة المستخدمين</h2>
          <p className="text-sm text-gray-500 mt-1">{usersList?.length || 0} مستخدم مسجل</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالاسم أو البريد..."
          className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {filtered.map((user: any) => (
          <Card key={user.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {(user.name || "U").charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{user.name || "بدون اسم"}</h3>
                    <p className="text-xs text-gray-500">{user.email || "—"}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">طريقة الدخول: {user.loginMethod || "—"} · انضم: {user.createdAt ? new Date(user.createdAt).toLocaleDateString("ar-SA") : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={user.role === "admin" ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600"}>
                    <ShieldCheck className="w-3 h-3 ml-1" />
                    {user.role === "admin" ? "مدير" : "مستخدم"}
                  </Badge>
                  <Button variant="outline" size="sm" className="text-xs h-8"
                    onClick={() => updateRoleMutation.mutate({ userId: user.id, role: user.role === "admin" ? "user" : "admin" })}
                    disabled={updateRoleMutation.isPending}>
                    {user.role === "admin" ? "تحويل لمستخدم" : "ترقية لمدير"}
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8 text-red-500 hover:text-red-700"
                    onClick={() => setDeleteDialog(user.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16"><Users className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">لا يوجد مستخدمين</p></div>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>حذف المستخدم</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>إلغاء</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteDialog) { deleteMutation.mutate({ userId: deleteDialog }); setDeleteDialog(null); } }}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
