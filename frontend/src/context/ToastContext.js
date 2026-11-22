'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

const Ctx = createContext({ success: () => {}, error: () => {} });
export const useToast = () => useContext(Ctx);

// Small success / error notifications (bottom right). Errors stay a little longer.
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l.slice(-3), { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), type === 'error' ? 8000 : 4500);
  }, []);
  const api = useMemo(() => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error') }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="no-print fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg ${t.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {t.type === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button aria-label="Dismiss" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}><X className="h-4 w-4 opacity-60" /></button>
          </div>))}
      </div>
    </Ctx.Provider>
  );
}
