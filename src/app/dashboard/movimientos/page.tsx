'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Category, Transaction, TransactionType, ExportData } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2, FileDown, Upload, Download, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TxForm {
  title: string; description: string; amount: string
  type: TransactionType; date: string; account_id: string; category_id: string
}
const blank: TxForm = { title: '', description: '', amount: '', type: 'expense', date: new Date().toISOString().slice(0, 10), account_id: '', category_id: '' }

export default function MovimientosPage() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [delTarget, setDelTarget] = useState<Transaction | null>(null)
  const [form, setForm] = useState<TxForm>(blank)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [pdfFrom, setPdfFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [pdfTo, setPdfTo] = useState(new Date().toISOString().slice(0, 10))
  const importRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    load()
    const ch = supabase.channel('movimientos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [t, a, c] = await Promise.all([
      supabase.from('transactions').select('*, account:accounts(*), category:categories(*)').eq('user_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    ])
    setTxs(t.data || [])
    setAccounts(a.data || [])
    setCategories(c.data || [])
    setLoading(false)
  }

  function openCreate() { setEditing(null); setForm({ ...blank, account_id: accounts[0]?.id || '' }); setOpen(true) }
  function openEdit(t: Transaction) {
    setEditing(t)
    setForm({ title: t.title, description: t.description || '', amount: String(t.amount), type: t.type, date: t.date, account_id: t.account_id, category_id: t.category_id || '' })
    setOpen(true)
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!form.title.trim()) { toast.error('El título es obligatorio'); return }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    if (!form.account_id) { toast.error('Seleccioná una cuenta'); return }
    const payload = {
      title: form.title.trim(), description: form.description || null,
      amount: Number(form.amount), type: form.type, date: form.date,
      account_id: form.account_id, category_id: form.category_id || null,
    }
    const { error } = editing
      ? await supabase.from('transactions').update(payload).eq('id', editing.id)
      : await supabase.from('transactions').insert({ ...payload, user_id: user.id })
    if (error) { toast.error('Error al guardar'); return }
    toast.success(editing ? 'Movimiento actualizado' : 'Movimiento registrado')
    setOpen(false); load()
  }

  async function remove() {
    if (!delTarget) return
    const { error } = await supabase.from('transactions').delete().eq('id', delTarget.id)
    if (error) { toast.error('Error al eliminar'); return }
    toast.success('Movimiento eliminado')
    setDelOpen(false); setDelTarget(null); load()
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const from = new Date(pdfFrom)
    const to = new Date(pdfTo)
    to.setHours(23, 59, 59)
    const filtered = txs.filter(t => { const d = new Date(t.date); return d >= from && d <= to })
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Mi Registro — Movimientos', 14, 18)
    doc.setFontSize(10)
    doc.text(`Período: ${format(from, 'dd/MM/yyyy')} — ${format(to, 'dd/MM/yyyy')}`, 14, 26)
    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    doc.text(`Ingresos: $${income.toFixed(2)}   Gastos: $${expenses.toFixed(2)}   Balance: $${(income - expenses).toFixed(2)}`, 14, 32)
    autoTable(doc, {
      startY: 38,
      head: [['Fecha', 'Título', 'Categoría', 'Cuenta', 'Tipo', 'Monto']],
      body: filtered.map(t => [
        format(new Date(t.date), 'dd/MM/yyyy'),
        t.title,
        (t.category as any)?.name || '-',
        (t.account as any)?.name || '-',
        t.type === 'income' ? 'Ingreso' : 'Gasto',
        `$${Number(t.amount).toFixed(2)}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
    })
    doc.save(`movimientos-${pdfFrom}-${pdfTo}.pdf`)
    setPdfOpen(false)
    toast.success('PDF exportado')
  }

  function exportJSON() {
    const data: Partial<ExportData> = {
      version: 1, exported_at: new Date().toISOString(), transactions: txs,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `movimientos-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
    toast.success('JSON exportado')
  }

  async function importJSON(file: File) {
    try {
      const text = await file.text()
      const data: ExportData = JSON.parse(text)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let imported = 0
      if (data.accounts?.length) {
        for (const a of data.accounts) {
          const { id, created_at, updated_at, ...rest } = a
          await supabase.from('accounts').upsert({ ...rest, id, user_id: user.id })
        }
      }
      if (data.categories?.length) {
        for (const c of data.categories) {
          const { id, created_at, ...rest } = c
          await supabase.from('categories').upsert({ ...rest, id, user_id: user.id })
        }
      }
      if (data.transactions?.length) {
        for (const t of data.transactions) {
          const { id, created_at, updated_at, account, category, ...rest } = t as any
          await supabase.from('transactions').upsert({ ...rest, id, user_id: user.id })
          imported++
        }
      }
      toast.success(`Importación completada: ${imported} movimientos`)
      load()
    } catch {
      toast.error('Error al importar: archivo inválido')
    }
  }

  const filtered = txs.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterAccount && t.account_id !== filterAccount) return false
    if (filterCategory && t.category_id !== filterCategory) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
  const hasFilters = search || filterType !== 'all' || filterAccount || filterCategory

  if (loading) return <div className="flex items-center justify-center h-full pt-14 lg:pt-0"><p className="text-slate-400 text-sm">Cargando...</p></div>

  return (
    <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Movimientos</h1>
          <p className="text-slate-500 text-sm">{filtered.length} de {txs.length} movimiento{txs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors">
              <Download className="w-4 h-4" />Exportar
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPdfOpen(true)}><FileDown className="mr-2 h-4 w-4" />Exportar PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON}><FileDown className="mr-2 h-4 w-4" />Exportar JSON</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => importRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Importar JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nuevo</Button>
        </div>
      </div>
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={e => { if (e.target.files?.[0]) importJSON(e.target.files[0]); e.target.value = '' }} />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-9" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5"><X className="h-4 w-4 text-slate-400" /></button>}
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Ingresos</SelectItem>
            <SelectItem value="expense">Gastos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAccount} onValueChange={v => setFilterAccount(v ?? '')}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Cuenta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las cuentas</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={v => setFilterCategory(v ?? '')}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las categorías</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(''); setFilterType('all'); setFilterAccount(''); setFilterCategory('') }}><X className="h-4 w-4 mr-1" />Limpiar</Button>}
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-5xl mb-4">📊</div>
            <p className="text-slate-600 font-medium mb-2">{txs.length === 0 ? 'No hay movimientos todavía' : 'Sin resultados'}</p>
            {txs.length === 0 && <Button onClick={openCreate} className="mt-2">Registrar movimiento</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border hover:shadow-sm transition-shadow">
              <div className={`w-2 h-10 rounded-full shrink-0 ${t.type === 'income' ? 'bg-green-400' : 'bg-red-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{t.title}</span>
                  {(t.category as any)?.name && (
                    <Badge variant="outline" className="text-xs h-5">{(t.category as any).icon} {(t.category as any).name}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">{format(new Date(t.date), 'dd MMM yyyy', { locale: es })}</span>
                  {(t.account as any)?.name && <span className="text-xs text-slate-400">· {(t.account as any).emoji} {(t.account as any).name}</span>}
                  {t.description && <span className="text-xs text-slate-400 truncate">· {t.description}</span>}
                </div>
              </div>
              <span className={`text-base font-bold shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'income' ? '+' : '-'}${fmt(Number(t.amount))}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 shrink-0 hover:bg-accent transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(t)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => { setDelTarget(t); setDelOpen(true) }}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Diálogo crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Tipo</Label>
              <div className="flex gap-2 mt-1">
                {(['expense', 'income'] as TransactionType[]).map(tp => (
                  <button key={tp} type="button" onClick={() => setForm(f => ({ ...f, type: tp }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${form.type === tp ? (tp === 'income' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {tp === 'income' ? '↑ Ingreso' : '↓ Gasto'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ej. Supermercado" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto *</Label>
                <Input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" type="number" min="0" step="0.01" className="mt-1" />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} type="date" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Cuenta *</Label>
              <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría (opcional)</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin categoría</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalle adicional..." className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Guardar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar movimiento</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">¿Eliminar <strong>{delTarget?.title}</strong>? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo PDF */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Exportar PDF</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Desde</Label>
              <Input value={pdfFrom} onChange={e => setPdfFrom(e.target.value)} type="date" className="mt-1" />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input value={pdfTo} onChange={e => setPdfTo(e.target.value)} type="date" className="mt-1" />
            </div>
            <p className="text-xs text-slate-400">
              Se exportarán {txs.filter(t => { const d = new Date(t.date); const f = new Date(pdfFrom); const to = new Date(pdfTo); to.setHours(23,59,59); return d >= f && d <= to }).length} movimientos en el rango seleccionado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Cancelar</Button>
            <Button onClick={exportPDF}><FileDown className="w-4 h-4 mr-2" />Exportar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
