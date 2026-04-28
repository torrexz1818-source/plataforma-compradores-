import { useEffect } from 'react';

export function useHighlight(id?: string | null) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(`item-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'all 0.3s';
    el.style.border = '2px solid var(--color-purple-innovation)';
    el.style.background = 'rgba(90, 49, 213, 0.10)';
    setTimeout(() => {
      el.style.border = '';
      el.style.background = '';
    }, 3000);
  }, [id]);
}
