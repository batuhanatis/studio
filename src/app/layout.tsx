import type {Metadata} from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Movie Finder',
  description: 'Find where to watch your favorite movies.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-body antialiased">
        <AuthProvider>
            {children}
            <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
