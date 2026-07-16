import { useState } from 'react';
import { Brain, Lock, Sparkles, FileText, Database, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);

    if (error) {
      setError(error);
    } else {
      toast(mode === 'login' ? 'Berhasil masuk!' : 'Akun berhasil dibuat! Silakan masuk.', 'success');
      if (mode === 'signup') {
        setMode('login');
        setPassword('');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <span className="text-xl font-bold">AI Office Dashboard</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            Asisten AI cerdas<br />untuk produktivitas kantor
          </h1>
          <p className="text-slate-400 text-lg mb-10 max-w-md">
            Chat dengan AI, unggah dokumen untuk analisis, dan kelola data Anda — semua dalam satu tempat.
          </p>

          <div className="space-y-4">
            <Feature icon={<MessageSquare className="w-5 h-5" />} title="Chat AI" desc="Berkonversasi dengan model qwen2.5:7b melalui Ollama" />
            <Feature icon={<FileText className="w-5 h-5" />} title="Analisis Dokumen" desc="PDF, Word, Excel diparse otomatis sebagai konteks AI" />
            <Feature icon={<Database className="w-5 h-5" />} title="Manajemen Data" desc="CRUD data kantor tersimpan aman di Supabase" />
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">AI Office Dashboard</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {mode === 'login' ? 'Masuk ke akun' : 'Buat akun baru'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {mode === 'login'
                  ? 'Selamat datang kembali. Masuk untuk melanjutkan.'
                  : 'Daftar untuk mulai menggunakan dashboard AI.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                name="email"
                label="Email"
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <div className="relative">
                <Input
                  type="password"
                  name="password"
                  label="Kata Sandi"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                  <Lock className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {mode === 'login' ? 'Masuk' : 'Daftar'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError('');
                }}
                className="font-medium text-teal-600 hover:text-teal-700"
              >
                {mode === 'login' ? 'Daftar di sini' : 'Masuk di sini'}
              </button>
            </p>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Didukung oleh Ollama & Supabase
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-teal-400 shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-slate-400">{desc}</p>
      </div>
    </div>
  );
}
