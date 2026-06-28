import './globals.css'
import { AudioProvider } from '@/context/AudioContext'

export const metadata = {
  title: 'Dolby Atmos Renderer — Geiger Audio',
  description: 'Professional spatial audio renderer',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AudioProvider>
          {children}
        </AudioProvider>
      </body>
    </html>
  )
}
