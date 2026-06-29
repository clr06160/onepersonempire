import type { ReactNode } from 'react';
import ScannerFooter from './_extras/ScannerFooter';

export default function ScannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ScannerFooter />
    </>
  );
}
