import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  Trash2,
  Search,
  Loader2,
  Crown,
  UserCircle,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { listUsers, changeUserRole, deleteUser, createUser, type AdminUser } from '../lib/admin';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';

export function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{ user: AdminUser; newRole: 'user' | 'admin' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [createLoading, setCreateLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat daftar user', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleChangeRole = async () => {
    if (!roleConfirm) return;
    setActionLoading(true);
    try {
      await changeUserRole(roleConfirm.user.id, roleConfirm.newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === roleConfirm.user.id ? { ...u, role: roleConfirm.newRole } : u)),
      );
      toast(`Role ${roleConfirm.user.email} diubah menjadi ${roleConfirm.newRole === 'admin' ? 'Admin' : 'User'}`, 'success');
      setRoleConfirm(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengubah role', 'error');
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(true);
    try {
      await deleteUser(deleteConfirm.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
      toast(`User ${deleteConfirm.email} berhasil dihapus`, 'success');
      setDeleteConfirm(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus user', 'error');
    }
    setActionLoading(false);
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      toast('Email dan kata sandi wajib diisi', 'error');
      return;
    }
    setCreateLoading(true);
    try {
      const created = await createUser(newEmail.trim(), newPassword.trim(), newRole);
      setUsers((prev) => [created, ...prev]);
      toast(`User ${newEmail.trim()} berhasil dibuat`, 'success');
      setCreateModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat user', 'error');
    }
    setCreateLoading(false);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const userCount = users.filter((u) => u.role === 'user').length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Manajemen User</h1>
            <p className="text-slate-500 text-sm">Kelola akun pengguna dan peran admin</p>
          </div>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Tambah User
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Total User</p>
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Admin</p>
          <p className="text-2xl font-bold text-slate-900">{adminCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-sky-600" />
            </div>
          </div>
          <p className="text-sm text-slate-500">User Biasa</p>
          <p className="text-2xl font-bold text-slate-900">{userCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Cari berdasarkan email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* User table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {users.length === 0 ? 'Belum ada user terdaftar.' : 'Tidak ada user yang cocok dengan pencarian.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3">Email</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3">Role</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3 hidden md:table-cell">Terdaftar</th>
                  <th className="text-right text-sm font-medium text-slate-600 px-5 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium uppercase ${
                            u.role === 'admin'
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.email.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{u.email}</p>
                            {isSelf && (
                              <span className="text-xs text-teal-600 font-medium">Anda</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role === 'admin' && <Crown className="w-3 h-3" />}
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-sm text-slate-500">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {u.role === 'admin' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isSelf}
                              onClick={() => setRoleConfirm({ user: u, newRole: 'user' })}
                            >
                              <UserCircle className="w-3.5 h-3.5" />
                              Jadikan User
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setRoleConfirm({ user: u, newRole: 'admin' })}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Jadikan Admin
                            </Button>
                          )}
                          <button
                            onClick={() => setDeleteConfirm(u)}
                            disabled={isSelf}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf ? 'Tidak dapat menghapus akun sendiri' : 'Hapus user'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role change confirmation */}
      <Modal
        open={!!roleConfirm}
        onClose={() => setRoleConfirm(null)}
        title="Konfirmasi Perubahan Role"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRoleConfirm(null)}>Batal</Button>
            <Button onClick={handleChangeRole} loading={actionLoading}>Konfirmasi</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Ubah role <span className="font-medium text-slate-900">{roleConfirm?.user.email}</span> menjadi{' '}
          <span className="font-medium text-slate-900">
            {roleConfirm?.newRole === 'admin' ? 'Admin' : 'User biasa'}
          </span>?
        </p>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus User?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDelete} loading={actionLoading}>
              <Trash2 className="w-4 h-4" />
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          User <span className="font-medium text-slate-900">{deleteConfirm?.email}</span> akan dihapus permanen
          beserta semua data yang terkait (chat, dokumen, data records). Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>

      {/* Create user modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Tambah User Baru"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreateUser} loading={createLoading}>
              <UserPlus className="w-4 h-4" />
              Buat
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nama@perusahaan.com"
            required
          />
          <Input
            label="Kata Sandi"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
            minLength={6}
            required
          />
          <Select
            label="Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </Select>
          <p className="text-xs text-slate-400">
            User akan langsung dapat login tanpa verifikasi email.
          </p>
        </div>
      </Modal>
    </div>
  );
}
