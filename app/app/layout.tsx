import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Git Quest: Molecule Screen',
  description: 'The practice app for Git Quest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  )
}
