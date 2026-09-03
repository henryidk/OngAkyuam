import type { ReactNode } from 'react'
import LogoutButton from './LogoutButton'

interface PanelLayoutProps {
  titulo: string
  children?: ReactNode
}

export default function PanelLayout({ titulo, children }: PanelLayoutProps) {
  return (
    <div>
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <LogoutButton />
      </header>
      {children && <div className="p-8">{children}</div>}
    </div>
  )
}
