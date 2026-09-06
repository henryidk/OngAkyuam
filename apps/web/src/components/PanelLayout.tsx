import type { ReactNode } from 'react'
import Navbar from './layout/Navbar'
import Sidebar from './layout/Sidebar'

interface PanelLayoutProps {
  titulo?: string
  children?: ReactNode
}

export default function PanelLayout({ children }: PanelLayoutProps) {
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <div className="app-main" style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main className="content-area" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', backgroundColor: '#FDFDF5' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
