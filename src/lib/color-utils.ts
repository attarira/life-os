export const PASTEL_COLORS = [
  { name: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', accent: 'border-blue-500', text: 'text-blue-800 dark:text-blue-200' },
  { name: 'emerald', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', accent: 'border-emerald-500', text: 'text-emerald-800 dark:text-emerald-200' },
  { name: 'violet', bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-violet-300 dark:border-violet-700', accent: 'border-violet-500', text: 'text-violet-800 dark:text-violet-200' },
  { name: 'amber', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', accent: 'border-amber-500', text: 'text-amber-800 dark:text-amber-200' },
  { name: 'rose', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', accent: 'border-rose-500', text: 'text-rose-800 dark:text-rose-200' },
  { name: 'cyan', bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-300 dark:border-cyan-700', accent: 'border-cyan-500', text: 'text-cyan-800 dark:text-cyan-200' },
  { name: 'fuchsia', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', border: 'border-fuchsia-300 dark:border-fuchsia-700', accent: 'border-fuchsia-500', text: 'text-fuchsia-800 dark:text-fuchsia-200' },
  { name: 'lime', bg: 'bg-lime-100 dark:bg-lime-900/30', border: 'border-lime-300 dark:border-lime-700', accent: 'border-lime-500', text: 'text-lime-800 dark:text-lime-200' },
];

export function getThemeColor(id: string) {
  // Deterministic hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}

export function getDateStatusColor(date: Date) {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'; // Overdue
  if (diffDays <= 3) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'; // Urgent
  if (diffDays <= 7) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'; // This week
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'; // Future
}

export function formatCompactDate(date: Date) {
  return `| ${date.getMonth() + 1}/${date.getDate()} |`;
}
