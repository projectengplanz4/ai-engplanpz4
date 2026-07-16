import { Loader2 } from 'lucide-react';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`w-5 h-5 animate-spin text-teal-600 ${className ?? ''}`} />;
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-32 bg-slate-200 rounded" />
    </div>
  );
}
