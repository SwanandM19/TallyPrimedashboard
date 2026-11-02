import type { Metadata } from 'next'
import { CashflowWorkspace } from '@/components/CashflowWorkspace'

export const metadata: Metadata = {
  title: 'Admin Review | Mantri Constructions Cashflow',
  description: 'Review and edit submitted Mantri Constructions cashflow reports.',
  openGraph: {
    title: 'Admin Review | Mantri Constructions Cashflow',
    description: 'Review submitted Mantri Constructions cashflow reports.',
    type: 'website',
  },
}

export default function AdminPage() {
  return <CashflowWorkspace adminPage />
}
