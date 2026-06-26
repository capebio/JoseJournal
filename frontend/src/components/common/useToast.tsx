import { useCallback, useState } from 'react';

/** Tiny toast: a flash(message) + the node to render. Matches the prototype pattern. */
export function useToast(): { toast: string | null; flash: (m: string) => void; node: React.ReactNode } {
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1900);
  }, []);
  const node = toast ? <div className="jose-toast">{toast}</div> : null;
  return { toast, flash, node };
}
