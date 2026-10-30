import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-geist',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ACCESS PR — Workflow assistant',
  description:
    'Internal workflow assistant for the ACCESS PR team: intake, research, strategy, releases, media lists and outreach.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        {/* Every page needs an active organization; Clerk sends people who
            have none to /select-org (see also middleware.ts). */}
        <ClerkProvider taskUrls={{ 'choose-organization': '/select-org' }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
