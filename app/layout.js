import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Bilbingo',
  description: 'Mobilvänlig bingobricka för bilintressen',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
