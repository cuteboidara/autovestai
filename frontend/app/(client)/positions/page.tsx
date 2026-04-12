import { redirect } from 'next/navigation';

export default function PositionsPage() {
  // FIX: Preserve the dedicated launch route while reusing the live terminal positions tab.
  redirect('/trade?tab=open');
}
