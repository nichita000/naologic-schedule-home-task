/** Human-readable inclusive date range like "May 1, 2026 – Jun 19, 2026". */
export function formatDateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}
