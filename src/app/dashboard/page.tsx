'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Transaction, Budget, SavingsGoal } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function calcBudgetSpent(budget: Budget, transactions: Transaction[]): number {
  const now = new Date()
  return transactions
    .filter(t => {
      if (t.type !== 'expense') return false
      if (budget.account_id && t.account_id !== budget.account_id) return false
      if (budget.category_id && t.category_id !== budget.category_id) return false
      const d = new Date(t.date)
      if (budget.period_type === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      if (budget.period_type === 'weekly') { const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); return d >= ws }
      if (budget.period_type === 'yearly') return d.getFullYear() === now.getFullYear()
      if (budget.start_date && budget.end_date) return d >= new Date(budget.start_date) && d <= new Date(budget.end_date)
      return true
    })
    .reduce((s, t) => s + Number(t.amount), 0)
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [a, t, b, g] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(200),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('savings_goals').select('*').eq('user_id', user.id),
      ])
      setAccounts(a.data || [])
      setTransactions(t.data || [])
      setBudgets(b.data || [])
      setGoals(g.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) return (
    <div className="flex items-center justify-center h-full pt-14 lg:pt-0">
      <div className="text-slate-400 text-sm">Cargando...</div>
    </div>
  )

  return (
    <div className="p-4 lg:p-8 pt-16 lg:pt-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Resumen</h1>
        <p className="text-slate-500 text-sm capitalize">{format(now, 'MMMM yyyy', { locale: es })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Ingresos del mes', value: income, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', iconColor: 'text-green-500' },
          { label: 'Gastos del mes', value: expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', iconColor: 'text-red-500' },
          { label: 'Balance del mes', value: income - expenses, icon: Wallet, color: income - expenses >= 0 ? 'text-blue-600' : 'text-orange-600', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
        ].map(({ label, value, icon: Icon, color, bg, iconColor }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>${fmt(value)}</p>
                </div>
                <div className={`${bg} p-2.5 rounded-xl`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cuentas */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Mis Cuentas</CardTitle>
            <Link href="/dashboard/cuentas"><Button variant="ghost" size="sm" className="text-xs h-7">Ver todas</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No hay cuentas.</p>
            ) : accounts.map(acc => {
              const bal = transactions.filter(t => t.account_id === acc.id)
                .reduce((s, t) => t.type === 'income' ? s + Number(t.amount) : s - Number(t.amount), 0)
              return (
                <div key={acc.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{acc.emoji}</span>
                    <span className="text-sm font-medium">{acc.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${bal >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                    ${fmt(bal)}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Movimientos recientes */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Últimos movimientos</CardTitle>
            <Link href="/dashboard/movimientos"><Button variant="ghost" size="sm" className="text-xs h-7">Ver todos</Button></Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No hay movimientos.</p>
            ) : transactions.slice(0, 6).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium leading-tight">{t.title}</p>
                  <p className="text-xs text-slate-400">{format(new Date(t.date), 'dd MMM', { locale: es })}</p>
                </div>
                <span className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'income' ? '+' : '-'}${fmt(Number(t.amount))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Presupuestos */}
      {budgets.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Presupuestos</CardTitle>
            <Link href="/dashboard/presupuestos"><Button variant="ghost" size="sm" className="text-xs h-7">Ver todos</Button></Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.slice(0, 5).map(b => {
              const spent = calcBudgetSpent(b, transactions)
              const pct = Math.min((spent / Number(b.amount)) * 100, 100)
              const over = spent > Number(b.amount)
              return (
                <div key={b.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className={`text-xs ${over ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                      ${fmt(spent)} / ${fmt(Number(b.amount))}
                    </span>
                  </div>
                  <Progress value={pct} className={over ? '[&>div]:bg-red-500' : ''} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Metas */}
      {goals.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Metas de ahorro</CardTitle>
            <Link href="/dashboard/metas"><Button variant="ghost" size="sm" className="text-xs h-7">Ver todas</Button></Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.slice(0, 4).map(g => {
              const pct = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100)
              return (
                <div key={g.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{g.emoji} {g.name}</span>
                    <span className="text-xs text-slate-500">${fmt(Number(g.current_amount))} / ${fmt(Number(g.target_amount))}</span>
                  </div>
                  <Progress value={pct} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
