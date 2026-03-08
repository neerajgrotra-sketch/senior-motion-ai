import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Overshoot V1 Pose Tracker',
  description: 'Single-person standing body tracking with stable ID and stick figure overlay.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
