import { redirect } from 'next/navigation';

export default function OrdersPage() {
  // FIX: Preserve the dedicated launch route while reusing the live terminal orders tab.
  redirect('/trade?tab=orders');
}
