import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
 title: 'TCG Poke Market - Buy & Sell Pokémon Cards',
 description: 'A Pokémon trading card marketplace for collectors, sellers, singles, and sealed products.',
}

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><Navbar/>{children}<SpeedInsights /></body></html>
}
