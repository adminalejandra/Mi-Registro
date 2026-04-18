'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Category, Budget, BudgetPeriod, Transaction } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface BForm {
  name: string; amount: string; account_id: string; category_id: string
  period_type: BudgetPeriod; start_date: string; end_date: string
}
const blank: BForm = { name: '', amount: '', account_id: '', category_id: '', period_type: 'monthly', start_date: '', end_date: '' }

const periodLabel: Record<BudgetPeriod, string> = { weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual', custom: 'Personalizado' }

function calcSpent(budget: Budget, txs: Transaction[]): number {
  const now = new Date()
  return txs.filter(t => {
    if (t.type !== 'expense') return false
    if (budget.account_id && t.account_id !== budget.account_id) return false
    if (budget.category_id && t.category_id !== budget.category_id) return false
    const d = new Date(t.date)
    if (budget.period_type === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (budget.period_type === 'weekly') { const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); return d >= ws }
    if (budget.period_type === 'yearly') return d.getFullYear() === now.getFullYear()
    if (budget.start_date && budget.end_date) return d >= new Date(budget.start_date) && d <= new Date(budget.end_date)
    return true
  }).reduce((s, t) => s + Number(t.amount), 0)
}

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [delTarget, setDelTarget] = useState<Budget | null>(null)
  const [form, setForm] = useState<BForm>(blank)
  const supabase = createClient()

  useEffect(() => {
    load()
    const ch = supabase.channel('presupuestos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [b, a, c, t] = await Promise.all([
      supabase.from('budgets').select('*, account:accounts(*), category:categories(*)').eq('user_id', user.id).order('created_at'),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('transactions').select('*').eq('user_id', user.id),
    ])
    setBudgets(b.data || [])
    setAccounts(a.data || [])
    setCategories(c.data || [])
    setTxs(t.data || [])
    setLoading(false)
  }

  function openCreate() { setEditing(null); setForm(blank); setOpen(true) }
  function openEdit(b: Budget) {
    setEditing(b)
    setForm({ name: b.name, amount: String(b.amount), account_id: b.account_id || '', category_id: b.category_id || '', period_type: b.period_type, start_date: b.start_date || '', end_date: b.end_date || '' })
    setOpen(true)
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    const payload = {
      name: form.name.trim(), amount: Number(form.amount),
      account_id: form.account_id || null, category_id: form.category_id || null,
      period_type: form.period_type,
      start_date: form.period_type === 'custom' ? form.start_date || null : null,
      end_date: form.period_type === 'custom' ? form.end_date || null : null,
    }
    const { error } = editing
      ? await supabase.from('budgets').update(payload).eq('id', editing.id)
      : await supabase.from('budgets').insert({ ...payload, user_id: user.id })
    if (error) { toast.error('Error al guardar'); return }
    toast.success(editing ? 'Presupuesto actualizado' : 'Presupuesto creado')
    setOpen(false); load()
  }

  async function remove() {
    if (!delTarget) return
    const { error } = await supabase.from('budgets').delete().eq('id', delTarget.id)
    if (error) { toast.error('Error al eliminar'); return }
    toast.success('Presupuesto eliminado')
    setDelOpen(false); setDelTarget(null); load()
  }

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

  if (loading) return <div className="flex items-center justify-center h-full pt-14 lg:pt-0"><p className="text-slate-400 text-sm">Cargando...</p></div>

  return (
    <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Presupuestos</h1>
          <p className="text-slate-500 text-sm">{budgets.length} presupuesto{budgets.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nuevo presupuesto</Button>
      </div>

      {budgets.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-slate-600 font-medium mb-2">No hay presupuestos todavía</p>
            <p className="text-slate-400 text-sm mb-4">Creá un presupuesto para controlar tus gastos por categoría o cuenta</p>
            <Button onClick={openCreate}>Crear presupuesto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map(b => {
            const spent = calcSpent(b, txs)
            const total = Number(b.amount)
            const pct = Math.min((spent / total) * 100, 100)
            const remaining = total - spent
            const over = spent > total
            const acc = (b.account as any)
            const cat = (b.category as any)
            return (
              <Card key={b.id} className={over ? 'border-red-200' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{periodLabel[b.period_type]}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-accent transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(b)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => { setDelTarget(b); setDelOpen(true) }}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {acc && <Badge variant="secondary" className="text-xs">{acc.emoji} {acc.name}</Badge>}
                    {cat && <Badge variant="secondary" className="text-xs">{cat.icon} {cat.name}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={pct} className={`mb-3 ${over ? '[&>div]:bg-red-500' : pct >= 80 ? '[&>div]:bg-orange-500' : ''}`} />
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Gastado</p>
                      <p className={`font-bold ${over ? 'text-red-600' : 'text-slate-800'}`}>${fmt(spent)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-xs">Presupuesto</p>
                      <p className="font-bold text-slate-800">${fmt(total)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">{over ? 'Excedido' : 'Disponible'}</p>
                      <p className={`font-bold ${over ? 'text-red-600' : 'text-green-600'}`}>{over ? '-' : ''}${fmt(Math.abs(remaining))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Gastos del mes" className="mt-1" />
            </div>
            <div>
              <Label>Monto límite *</Label>
              <Input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" />
            </div>
            <div>
              <Label>Período</Label>
              <Select value={form.period_type} onValueChange={v => setForm(f => ({ ...f, period_type: v as BudgetPeriod }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.period_type === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Desde</Label>
                  <Input value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} type="date" className="mt-1" />
                </div>
                <div>
                  <Label>Hasta</Label>
                  <Input value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} type="date" className="mt-1" />
                </div>
              </div>
            )}
            <div>
              <Label>Cuenta (opcional)</Label>
              <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Todas las cuentas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las cuentas</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría (opcional)</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las categorías</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar presupuesto</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">¿Eliminar el presupuesto <strong>{delTarget?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
