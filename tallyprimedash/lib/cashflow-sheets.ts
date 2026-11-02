export const TABS = [
  { id: 'oppl', label: 'OPPL - Cash Flow' },
  { id: 'prerana', label: 'Prerana - Cash Flow' },
  { id: 'pppl', label: 'PPPL - Cash Flow' },
  { id: 'mcpl', label: 'MCPL - Cash Flow' },
  { id: 'apex', label: 'APEX - Cash Flow' },
  { id: 'ra', label: 'RA - Cash Flow' },
] as const
export type SheetId = (typeof TABS)[number]['id']
