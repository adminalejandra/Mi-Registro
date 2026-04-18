'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, SavingsGoal } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2, PlusCircle, MinusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const EMOJIS = ['🎯','💰','🏠','🚗','✈️','🎓','💍','🌴','📱','🎮','🏋️','🎵','🚀','💎','🌟','🏖️']
const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16']

interface GForm { name: string; target_amount: string; current_amount: string; deadline: string; emoji: string; color: string; description: string; account_id: string }
const blank: GForm = { name: '', target_amount: '', current_amount: '0', deadline: '', emoji: '🎯', color: '#10b981', description: '', account_id: '' }

export default function MetasPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [delTarget, setDelTarget] = useState<SavingsGoal | null>(null)
  const [addTarget, setAddTarget] = useState<SavingsGoal | null>(null)
  const [addAmount, setAddAmount] = useState('')
  const [addSign, setAddSign] = useState<1 | -1>(1)
  const [form, setForm] = useState<GForm>(blank)
  const supabase = createClient()

  useEffect(() => {
    load()
    const ch = supabase.channel('metas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [g, a] = await Promise.all([
      supabase.from('savings_goals').select('*, account:accounts(*)').eq('user_id', user.id).order('created_at'),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
    ])
    setGoals(g.data || [])
    setAccounts(a.data || [])
    setLoading(false)
  }

  function openCreate() { setEditing(null); setForm(blank); setOpen(true) }
  function openEdit(g: SavingsGoal) {
    setEditing(g)
    setForm({ name: g.name, target_amount: String(g.target_amount), current_amount: String(g.current_amount), deadline: g.deadline || '', emoji: g.emoji, color: g.color, description: g.description || '', account_id: g.account_id || '' })
    setOpen(true)
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!form.target_amount || Number(form.target_amount) <= 0) { toast.error('El monto objetivo debe ser mayor a 0'); return }
    const payload = {
      name: form.name.trim(), target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
      deadline: form.deadline || null, emoji: form.emoji, color: form.color,
      description: form.description || null, account_id: form.account_id || null,
    }
    const { error } = editing
      ? await supabase.from('savings_goals').update(payload).eq('id', editing.id)
      : await supabase.from('savings_goals').insert({ ...payload, user_id: user.id })
    if (error) { toast.error('Error al guardar'); return }
    toast.success(editing ? 'Meta actualizada' : 'Meta creada')
    setOpen(false); load()
  }

  async function remove() {
    if (!delTarget) return
    const { error } = await supabase.from('savings_goals').delete().eq('id', delTarget.id)
    if (error) { toast.error('Error al eliminar'); return }
    toast.success('Meta eliminada')
    setDelOpen(false); setDelTarget(null); load()
  }

  async function adjustAmount() {
    if (!addTarget || !addAmount || Number(addAmount) <= 0) { toast.error('Ingresá un monto válido'); return }
    const newAmount = Math.max(0, Number(addTarget.current_amount) + addSign * Number(addAmount))
    const { error } = await supabase.from('savings_goals').update({ current_amount: newAmount }).eq('id', addTarget.id)
    if (error) { toast.error('Error al actualizar'); return }
    toast.success('Monto actualizado')
    setAddOpen(false); setAddAmount(''); load()
  }

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

  if (loading) return <div className="flex items-center justify-center h-full pt-14 lg:pt-0"><p className="text-slate-400 text-sm">Cargando...</p></div>

  return (
    <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Metas de ahorro</h1>
          <p className="text-slate-500 text-sm">{goals.length} meta{goals.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva meta</Button>
      </div>

      {goals.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-slate-600 font-medium mb-2">No hay metas todavía</p>
            <p className="text-slate-400 text-sm mb-4">Creá una meta de ahorro para alcanzar tus objetivos financieros</p>
            <Button onClick={openCreate}>Crear meta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map(g => {
            const current = Number(g.current_amount)
            const target = Number(g.target_amount)
            const pct = Math.min((current / target) * 100, 100)
            const done = current >= target
            const acc = (g.account as any)
            return (
              <Card key={g.id} className={done ? 'border-green-200 bg-green-50/30' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: g.color + '20' }}>
                        {g.emoji}
                      </div>
                      <div>
                        <CardTitle className="text-base">{g.name}</CardTitle>
                        {g.deadline && (
                          <p className="text-xs text-slate-400">Hasta {format(new Date(g.deadline), 'dd MMM yyyy', { locale: es })}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 hover:bg-accent transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setAddTarget(g); setAddSign(1); setAddAmount(''); setAddOpen(true) }}><PlusCircle className="mr-2 h-4 w-4" />Agregar monto</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setAddTarget(g); setAddSign(-1); setAddAmount(''); setAddOpen(true) }}><MinusCircle className="mr-2 h-4 w-4" />Restar monto</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(g)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => { setDelTarget(g); setDelOpen(true) }}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={pct} className={`mb-3 ${done ? '[&>div]:bg-green-500' : ''}`} />
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Ahorrado</p>
                      <p className="font-bold" style={{ color: g.color }}>${fmt(current)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-xs">{done ? '¡Logrado!' : `${pct.toFixed(0)}%`}</p>
                      {done && <span className="text-lg">🎉</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Objetivo</p>
                      <p className="font-bold text-slate-800">${fmt(target)}</p>
                    </div>
                  </div>
                  {acc && <p className="text-xs text-slate-400 mt-2">{acc.emoji} {acc.name}</p>}
                  {g.description && <p className="text-xs text-slate-400 mt-1">{g.description}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Diálogo crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar meta' : 'Nueva meta de ahorro'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Viaje a Europa" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto objetivo *</Label>
                <Input value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>Monto actual</Label>
                <Input value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={`text-xl p-1.5 rounded-lg border-2 transition-all ${form.emoji === e ? 'border-slate-700 bg-slate-100' : 'border-transparent hover:border-slate-200'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-[3px] transition-transform ${form.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <Label>Fecha límite (opcional)</Label>
              <Input value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} type="date" className="mt-1" />
            </div>
            <div>
              <Label>Cuenta asociada (opcional)</Label>
              <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sin cuenta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cuenta</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción de la meta..." className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Guardar' : 'Crear meta'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo ajustar monto */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{addSign === 1 ? 'Agregar' : 'Restar'} monto a {addTarget?.name}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Monto</Label>
            <Input value={addAmount} onChange={e => setAddAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" autoFocus />
            <p className="text-xs text-slate-400 mt-2">
              Monto actual: ${fmt(Number(addTarget?.current_amount))} → ${fmt(Math.max(0, Number(addTarget?.current_amount) + addSign * Number(addAmount || 0)))}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={adjustAmount}>{addSign === 1 ? 'Agregar' : 'Restar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar meta</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">¿Eliminar la meta <strong>{delTarget?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
