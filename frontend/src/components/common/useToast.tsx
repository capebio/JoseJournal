import { useCallback, useEffect, useRef, useState } from 'react';

/** Tiny toast: a flash(message) + the node to render. The node is an aria-live
 *  region (WCAG 4.1.3) so success/error feedback is announced to screen readers;
 *  the dismiss timer is tracked and cleared so rapid flashes don't clip each other. */
export function useToast(): { toast: string | null; flash: (m: string) => void; node: React.ReactNode } {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(m);
    timer.current = setTimeout(() => setToast(null), 1900);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = (
    <div className="jose-toast" role="status" aria-live="polite" aria-atomic="true" style={toast ? undefined : { display: 'none' }}>
      {toast}
    </div>
  );
  return { toast, flash, node };
}
