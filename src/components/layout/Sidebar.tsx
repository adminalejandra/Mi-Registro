'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type User } from '@supabase/supabase-js'
import { LayoutDashboard, Wallet, ArrowLeftRight, Target, PiggyBank, Tag, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/dashboard/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/dashboard/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/dashboard/presupuestos', label: 'Presupuestos', icon: Target },
  { href: '/dashboard/metas', label: 'Metas de ahorro', icon: PiggyBank },
  { href: '/dashboard/categorias', label: 'Categorías', icon: Tag },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname === href
              ? 'bg-slate-800 text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )
}

function UserFooter({ user }: { user: User }) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="p-3 border-t">
      <div className="flex items-center gap-2 p-2 rounded-lg mb-1">
        <Avatar className="h-7 w-7">
          <AvatarImage src={user.user_metadata?.avatar_url} />
          <AvatarFallback className="text-xs">{user.email?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <p className="text-xs font-medium text-slate-700 truncate flex-1">
          {user.user_metadata?.full_name || user.email}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="w-full justify-start text-slate-500 hover:text-slate-800" onClick={handleLogout}>
        <LogOut className="w-4 h-4 mr-2" />
        Cerrar sesión
      </Button>
    </div>
  )
}

export default function Sidebar({ user }: { user: User }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-60 bg-white border-r flex-col shrink-0 h-screen sticky top-0">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-slate-800">💰 Mi Registro</h1>
        </div>
        <NavLinks />
        <UserFooter user={user} />
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b px-4 h-14 flex items-center justify-between">
        <h1 className="font-bold text-slate-800">💰 Mi Registro</h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-slate-100 transition-colors">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-60 flex flex-col">
            <div className="p-4 border-b">
              <h1 className="text-lg font-bold text-slate-800">💰 Mi Registro</h1>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <UserFooter user={user} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
