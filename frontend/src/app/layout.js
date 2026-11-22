import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';

export const metadata = { title: 'HMS - Hospital Management System', description: 'Hospital management dashboards' };

export default function RootLayout({ children }) {
  return (
    <html lang="en"><body><AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider></body></html>
  );
}
