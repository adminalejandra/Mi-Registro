'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Transaction } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'

import { toast } from 'sonner'

const EMOJIS = ['💰','🏦','💳','🏠','🚗','✈️','🎓','💼','🛒','💊','🎮','🍔','⚡','📱','🌟','💎','🏋️','🎵','🌈','🎯']
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#a855f7']

interface Form { name: string; emoji: string; color: string; description: string }
const blank: Form = { name: '', emoji: '💰', color: '#3b82f6', description: '' }

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [delTarget, setDelTarget] = useState<Account | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const supabase = createClient()

  useEffect(() => {
    load()
    const ch = supabase.channel('cuentas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [a, t] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('*').eq('user_id', user.id),
    ])
    setAccounts(a.data || [])
    setTransactions(t.data || [])
    setLoading(false)
  }

  function balance(id: string) {
    return transactions.filter(t => t.account_id === id)
      .reduce((s, t) => t.type === 'income' ? s + Number(t.amount) : s - Number(t.amount), 0)
  }

  function openCreate() { setEditing(null); setForm(blank); setOpen(true) }
  function openEdit(a: Account) { setEditing(a); setForm({ name: a.name, emoji: a.emoji, color: a.color, description: a.description || '' }); setOpen(true) }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    const payload = { name: form.name.trim(), emoji: form.emoji, color: form.color, description: form.description || null }
    const { error } = editing
      ? await supabase.from('accounts').update(payload).eq('id', editing.id)
      : await supabase.from('accounts').insert({ ...payload, user_id: user.id })
    if (error) { toast.error('Error al guardar'); return }
    toast.success(editing ? 'Cuenta actualizada' : 'Cuenta creada')
    setOpen(false)
    load()
  }

  async function remove() {
    if (!delTarget) return
    const { error } = await supabase.from('accounts').delete().eq('id', delTarget.id)
    if (error) { toast.error('Error al eliminar'); return }
    toast.success('Cuenta eliminada')
    setDelOpen(false); setDelTarget(null); load()
  }

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

  if (loading) return <div className="flex items-center justify-center h-full pt-14 lg:pt-0"><p className="text-slate-400 text-sm">Cargando...</p></div>

  return (
    <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cuentas</h1>
          <p className="text-slate-500 text-sm">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva cuenta</Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-5xl mb-4">💳</div>
            <p className="text-slate-600 font-medium mb-2">No hay cuentas todavía</p>
            <p className="text-slate-400 text-sm mb-4">Crea tu primera cuenta para registrar movimientos</p>
            <Button onClick={openCreate}>Crear cuenta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => {
            const bal = balance(acc.id)
            return (
              <Card key={acc.id} className="overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: acc.color }} />
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{acc.emoji}</span>
                      <CardTitle className="text-base">{acc.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 shrink-0 hover:bg-accent transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(acc)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => { setDelTarget(acc); setDelOpen(true) }}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${bal >= 0 ? 'text-slate-800' : 'text-red-600'}`}>${fmt(bal)}</p>
                  {acc.description && <p className="text-xs text-slate-400 mt-1">{acc.description}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Diálogo crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Cuenta corriente" className="mt-1" />
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
              <Label>Descripción (opcional)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción..." className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Guardar cambios' : 'Crear cuenta'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar cuenta</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">¿Eliminar <strong>{delTarget?.name}</strong>? Se eliminarán también todos sus movimientos asociados.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
