import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileType,
  Trash2,
  Eye,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseFile, isSupportedFile, type ParsedDocument } from '../lib/parsers';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface DocRecord {
  id: string;
  filename: string;
  file_type: 'pdf' | 'word' | 'excel';
  file_size: number;
  parsed_content: string;
  content_kind: 'text' | 'markdown';
  created_at: string;
}

export function DocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DocRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('id, filename, file_type, file_size, parsed_content, content_kind, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast('Gagal memuat dokumen', 'error');
    } else {
      setDocs(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!isSupportedFile(file.name)) {
        toast(`Format ${file.name} tidak didukung`, 'error');
        continue;
      }
      try {
        const parsed: ParsedDocument = await parseFile(file);
        const { error } = await supabase.from('documents').insert({
          filename: file.name,
          file_type: parsed.fileType,
          file_size: file.size,
          parsed_content: parsed.content,
          content_kind: parsed.kind,
        });
        if (error) {
          toast(`Gagal menyimpan ${file.name}`, 'error');
        } else {
          toast(`${file.name} berhasil diunggah`, 'success');
        }
      } catch (err) {
        toast(`Gagal memproses ${file.name}: ${err instanceof Error ? err.message : 'kesalahan tidak diketahui'}`, 'error');
      }
    }
    setUploading(false);
    loadDocs();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (doc: DocRecord) => {
    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) {
      toast('Gagal menghapus dokumen', 'error');
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleteConfirm(null);
    toast('Dokumen dihapus', 'success');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

  const fileIcon = (type: string) => {
    if (type === 'pdf') return <FileType className="w-5 h-5 text-rose-500" />;
    if (type === 'word') return <FileText className="w-5 h-5 text-sky-500" />;
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  };

  const fileTypeLabel = (type: string) => {
    if (type === 'pdf') return 'PDF';
    if (type === 'word') return 'Word';
    return 'Excel';
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Dokumen</h1>
        <p className="text-slate-500 mt-1">
          Unggah PDF, Word, atau Excel. File diparse otomatis menjadi teks/tabel Markdown untuk konteks AI.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-8 lg:p-12 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-teal-400 bg-teal-50'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
            <p className="text-sm text-slate-600">Memproses dan mengunggah...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="font-medium text-slate-700">Seret file ke sini atau klik untuk memilih</p>
              <p className="text-sm text-slate-400 mt-1">Mendukung PDF, Word (.docx), Excel (.xlsx, .csv)</p>
            </div>
          </div>
        )}
      </div>

      {/* Document list */}
      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Belum ada dokumen diunggah</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3">Nama File</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3 hidden sm:table-cell">Tipe</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3 hidden md:table-cell">Ukuran</th>
                  <th className="text-left text-sm font-medium text-slate-600 px-5 py-3 hidden lg:table-cell">Tanggal</th>
                  <th className="text-right text-sm font-medium text-slate-600 px-5 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {fileIcon(doc.file_type)}
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                          {doc.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                        {fileTypeLabel(doc.file_type)}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-sm text-slate-500">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell text-sm text-slate-500">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewDoc(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-teal-600 transition-colors"
                          title="Lihat konten"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(doc)}
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
        )}
      </div>

      {/* View document content modal */}
      <Modal
        open={!!viewDoc}
        onClose={() => setViewDoc(null)}
        title={viewDoc?.filename ?? ''}
        size="xl"
      >
        {viewDoc && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                {fileTypeLabel(viewDoc.file_type)}
              </span>
              <span className="text-xs text-slate-400">{formatSize(viewDoc.file_size)}</span>
              <span className="text-xs text-slate-400">
                {viewDoc.content_kind === 'markdown' ? 'Format: Tabel Markdown' : 'Format: Teks Biasa'}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                {viewDoc.parsed_content}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus Dokumen?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              <Trash2 className="w-4 h-4" />
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Dokumen "{deleteConfirm?.filename}" akan dihapus permanen.
        </p>
      </Modal>
    </div>
  );
}
