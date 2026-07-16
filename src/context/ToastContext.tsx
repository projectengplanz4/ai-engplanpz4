import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg border animate-slide-in ${
              t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : t.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 shrink-0 mt-0.5" />}
            <span className="text-sm leading-snug flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
