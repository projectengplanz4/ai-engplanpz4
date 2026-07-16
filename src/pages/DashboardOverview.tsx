import { useEffect, useState } from 'react';
import {
  Database,
  FileText,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Plus,
  Upload,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { View } from '../components/DashboardLayout';

interface Stats {
  dataRecords: number;
  documents: number;
  chatSessions: number;
}

export function DashboardOverview({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [stats, setStats] = useState<Stats>({ dataRecords: 0, documents: 0, chatSessions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [records, docs, sessions] = await Promise.all([
        supabase.from('data_records').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('chat_sessions').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        dataRecords: records.count ?? 0,
        documents: docs.count ?? 0,
        chatSessions: sessions.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Ringkasan aktivitas dan statistik Anda</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Database className="w-5 h-5" />}
          label="Total Data"
          value={stats.dataRecords}
          loading={loading}
          color="teal"
          onClick={() => onNavigate('data')}
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Dokumen"
          value={stats.documents}
          loading={loading}
          color="sky"
          onClick={() => onNavigate('documents')}
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Sesi Chat"
          value={stats.chatSessions}
          loading={loading}
          color="amber"
          onClick={() => onNavigate('chat')}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <QuickAction
          icon={<Sparkles className="w-5 h-5" />}
          title="Mulai Chat AI"
          desc="Berkonversasi dengan qwen2.5:7b"
          onClick={() => onNavigate('chat')}
        />
        <QuickAction
          icon={<Upload className="w-5 h-5" />}
          title="Unggah Dokumen"
          desc="PDF, Word, atau Excel"
          onClick={() => onNavigate('documents')}
        />
        <QuickAction
          icon={<Plus className="w-5 h-5" />}
          title="Tambah Data"
          desc="Buat catatan data baru"
          onClick={() => onNavigate('data')}
        />
      </div>

      {/* Feature highlights */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Fitur Unggulan</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Feature
            icon={<MessageSquare className="w-5 h-5" />}
            title="Chat AI Cerdas"
            desc="Berkonversasi langsung dengan model lokal qwen2.5:7b melalui Ollama. Jawaban streaming real-time."
          />
          <Feature
            icon={<FileText className="w-5 h-5" />}
            title="Parser Dokumen"
            desc="PDF dan Word diubah jadi teks biasa, Excel jadi tabel Markdown — semua diproses di browser."
          />
          <Feature
            icon={<Database className="w-5 h-5" />}
            title="Manajemen Data CRUD"
            desc="Kelola data kantor dengan operasi tambah, ubah, hapus. Tersimpan aman di Supabase."
          />
        </div>
      </div>
    </div>
  );
}

const colorMap = {
  teal: 'bg-teal-50 text-teal-600 border-teal-100',
  sky: 'bg-sky-50 text-sky-600 border-sky-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
};

function StatCard({
  icon,
  label,
  value,
  loading,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  color: keyof typeof colorMap;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-slate-300 hover:shadow-md transition-all group cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
          {icon}
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      )}
    </button>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-md transition-all group text-left"
    >
      <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 transition-colors" />
    </button>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div>
      <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}
