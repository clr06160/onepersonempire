import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Old Garden URL — Fun is the optional canopy hub now. */
export default function GardenPage() {
  redirect('/scanner/fun');
}
