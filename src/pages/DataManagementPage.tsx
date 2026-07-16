import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Database, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Loader2 } from 'lucide-react';

interface DataRecord {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: 'pending' | 'active' | 'done';
  created_at: string;
  updated_at: string;
}

type Status = 'pending' | 'active' | 'done';

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  active: { label: 'Aktif', className: 'bg-teal-100 text-teal-700' },
  done: { label: 'Selesai', className: 'bg-slate-100 text-slate-600' },
};

export function DataManagementPage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DataRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<Status>('pending');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('data_records')
      .select('id, title, description, category, status, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast('Gagal memuat data', 'error');
    } else {
      setRecords(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setStatus('pending');
    setModalOpen(true);
  };

  const openEdit = (record: DataRecord) => {
    setEditing(record);
    setTitle(record.title);
    setDescription(record.description ?? '');
    setCategory(record.category ?? '');
    setStatus(record.status);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Judul wajib diisi', 'error');
      return;
    }
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from('data_records')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          status,
        })
        .eq('id', editing.id);

      if (error) {
        toast('Gagal memperbarui data', 'error');
      } else {
        toast('Data diperbarui', 'success');
        setModalOpen(false);
        loadRecords();
      }
    } else {
      const { error } = await supabase.from('data_records').insert({
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        status,
      });

      if (error) {
        toast('Gagal menambah data', 'error');
      } else {
        toast('Data ditambahkan', 'success');
        setModalOpen(false);
        loadRecords();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (record: DataRecord) => {
    const { error } = await supabase.from('data_records').delete().eq('id', record.id);
    if (error) {
      toast('Gagal menghapus data', 'error');
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    setDeleteConfirm(null);
    toast('Data dihapus', 'success');
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filtered = records.filter((r) => {
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (r.category?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Manajemen Data</h1>
          <p className="text-slate-500 mt-1">Kelola data kantor Anda dengan operasi CRUD</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Tambah Data
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari berdasarkan judul, deskripsi, atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as Status | 'all')}
            className="pl-10 min-w-[160px]"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="active">Aktif</option>
            <option value="done">Selesai</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">
            {records.length === 0 ? 'Belum ada data. Tambahkan data pertama Anda.' : 'Tidak ada data yang cocok dengan filter.'}
          </p>
          {records.length === 0 && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Tambah Data
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3">Judul</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3 hidden md:table-cell">Kategori</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3">Status</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3 hidden lg:table-cell">Dibuat</th>
                  <th className="text-right text-sm font-medium text-slate-600 px-5 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900">{record.title}</p>
                      {record.description && (
                        <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                          {record.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {record.category ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                          {record.category}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig[record.status].className}`}>
                        {statusConfig[record.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-slate-500">
                      {formatDate(record.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(record)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-teal-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(record)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Data' : 'Tambah Data Baru'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Judul"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Masukkan judul data"
            required
          />
          <Textarea
            label="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi singkat (opsional)"
            rows={3}
          />
          <Input
            label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Misal: Keuangan, HRD, Operasional"
          />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="pending">Pending</option>
            <option value="active">Aktif</option>
            <option value="done">Selesai</option>
          </Select>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus Data?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => handleDelete(deleteConfirm!)}>
              <Trash2 className="w-4 h-4" />
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Data "{deleteConfirm?.title}" akan dihapus permanen.
        </p>
      </Modal>
    </div>
  );
}
