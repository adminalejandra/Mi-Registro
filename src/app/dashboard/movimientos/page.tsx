'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Category, CategoryType, Transaction, TransactionType, ExportData } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2, FileDown, Upload, Download, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ---------- constantes compartidas ----------
const ACCT_EMOJIS = ['💰','🏦','💳','🏠','🚗','✈️','🎓','💼','🛒','💊','🎮','🍔','⚡','📱','🌟','💎']
const CAT_EMOJIS  = ['📁','🏠','🚗','🍔','👕','💊','🎮','✈️','📚','💡','🎁','🏋️','🎵','💼','🛒','🏥']
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#6b7280']

// ---------- tipos ----------
interface TxForm {
  title: string; description: string; amount: string
  type: TransactionType; date: string; account_id: string; category_id: string
}
interface QAccForm { name: string; emoji: string; color: string }
interface QCatForm { name: string; icon: string; color: string; type: CategoryType }

const blankTx = (): TxForm => ({
  title: '', description: '', amount: '', type: 'expense',
  date: new Date().toISOString().slice(0, 10), account_id: '', category_id: '',
})
const blankQAcc: QAccForm = { name: '', emoji: '💰', color: '#3b82f6' }
const blankQCat: QCatForm = { name: '', icon: '📁', color: '#6b7280', type: 'both' }

// ---------- Select nativo con estilo consistente ----------
function AppSelect({ value, onChange, children, className }: {
  value: string; onChange: (v: string) => void
  children: React.ReactNode; className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 ${className ?? ''}`}
    >
      {children}
    </select>
  )
}

// ---------- componente principal ----------
export default function MovimientosPage() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // diálogo principal
  const [open, setOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [delTarget, setDelTarget] = useState<Transaction | null>(null)
  const [form, setForm] = useState<TxForm>(blankTx())

  // quick-create cuenta
  const [qAccOpen, setQAccOpen] = useState(false)
  const [qAccForm, setQAccForm] = useState<QAccForm>(blankQAcc)

  // quick-create categoría
  const [qCatOpen, setQCatOpen] = useState(false)
  const [qCatForm, setQCatForm] = useState<QCatForm>(blankQCat)

  // filtros
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // PDF
  const [pdfFrom, setPdfFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [pdfTo, setPdfTo] = useState(new Date().toISOString().slice(0, 10))

  const importRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // ---------- carga de datos ----------
  useEffect(() => {
    load()
    const ch = supabase.channel('movimientos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---------- CRUD movimientos ----------
  function openCreate() {
    setEditing(null)
    setForm({ ...blankTx(), account_id: accounts[0]?.id || '' })
    setOpen(true)
  }

  function openEdit(t: Transaction) {
    setEditing(t)
    setForm({
      title: t.title, description: t.description || '', amount: String(t.amount),
      type: t.type, date: t.date, account_id: t.account_id, category_id: t.category_id || '',
    })
    setOpen(true)
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const catName = categories.find(c => c.id === form.category_id)?.name
    const resolvedTitle = form.title.trim() || catName || ''
    if (!resolvedTitle) { toast.error('Ingresá un título o seleccioná una categoría'); return }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    if (!form.account_id) { toast.error('Seleccioná una cuenta'); return }
    const payload = {
      title: resolvedTitle, description: form.description || null,
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

  // ---------- quick-create cuenta ----------
  async function quickSaveAccount() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!qAccForm.name.trim()) { toast.error('El nombre es obligatorio'); return }
    const { data, error } = await supabase.from('accounts')
      .insert({ user_id: user.id, name: qAccForm.name.trim(), emoji: qAccForm.emoji, color: qAccForm.color, description: null })
      .select().single()
    if (error) { toast.error('Error al crear cuenta'); return }
    toast.success('Cuenta creada')
    setQAccOpen(false)
    setQAccForm(blankQAcc)
    await load()
    setForm(f => ({ ...f, account_id: data.id }))
  }

  // ---------- quick-create categoría ----------
  async function quickSaveCategory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!qCatForm.name.trim()) { toast.error('El nombre es obligatorio'); return }
    const { data, error } = await supabase.from('categories')
      .insert({ user_id: user.id, name: qCatForm.name.trim(), icon: qCatForm.icon, color: qCatForm.color, type: qCatForm.type })
      .select().single()
    if (error) { toast.error('Error al crear categoría'); return }
    toast.success('Categoría creada')
    setQCatOpen(false)
    setQCatForm(blankQCat)
    await load()
    setForm(f => ({ ...f, category_id: data.id }))
  }

  // ---------- exportar / importar ----------
  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const from = new Date(pdfFrom + 'T00:00:00')
    const to = new Date(pdfTo + 'T23:59:59')
    const filtered = txs.filter(t => { const d = new Date(t.date + 'T12:00:00'); return d >= from && d <= to })
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('Mi Registro — Movimientos', 14, 18)
    doc.setFontSize(10); doc.text(`Período: ${format(from, 'dd/MM/yyyy')} — ${format(to, 'dd/MM/yyyy')}`, 14, 26)
    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    doc.text(`Ingresos: $${income.toFixed(2)}   Gastos: $${expenses.toFixed(2)}   Balance: $${(income - expenses).toFixed(2)}`, 14, 32)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoTable(doc, { startY: 38, head: [['Fecha','Título','Categoría','Cuenta','Tipo','Monto']], body: filtered.map(t => [format(new Date(t.date + 'T12:00:00'),'dd/MM/yyyy'), t.title, (t.category as any)?.name||'-', (t.account as any)?.name||'-', t.type==='income'?'Ingreso':'Gasto', `$${Number(t.amount).toFixed(2)}`]), styles: { fontSize: 9 }, headStyles: { fillColor: [30,41,59] } })
    doc.save(`movimientos-${pdfFrom}-${pdfTo}.pdf`)
    setPdfOpen(false); toast.success('PDF exportado')
  }

  function exportJSON() {
    const data: Partial<ExportData> = { version: 1, exported_at: new Date().toISOString(), transactions: txs }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `movimientos-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url); toast.success('JSON exportado')
  }

  async function importJSON(file: File) {
    try {
      const data: ExportData = JSON.parse(await file.text())
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let imported = 0
      if (data.accounts?.length) for (const a of data.accounts) { const { id, ...rest } = a; await supabase.from('accounts').upsert({ ...rest, id, user_id: user.id }) }
      if (data.categories?.length) for (const c of data.categories) { const { id, ...rest } = c; await supabase.from('categories').upsert({ ...rest, id, user_id: user.id }) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data.transactions?.length) for (const t of data.transactions) { const { id, account, category, ...rest } = t as any; await supabase.from('transactions').upsert({ ...rest, id, user_id: user.id }); imported++ }
      toast.success(`Importación completada: ${imported} movimientos`); load()
    } catch { toast.error('Archivo inválido') }
  }

  // ---------- filtrado y saldo acumulado ----------
  const filtered = txs.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterAccount && t.account_id !== filterAccount) return false
    if (filterCategory && t.category_id !== filterCategory) return false
    if (search) { const q = search.toLowerCase(); if (!t.title.toLowerCase().includes(q) && !(t.description||'').toLowerCase().includes(q)) return false }
    return true
  })

  const balanceMap = new Map<string, number>()
  const sortedAsc = [...filtered].sort((a, b) => { const d = new Date(a.date).getTime() - new Date(b.date).getTime(); return d !== 0 ? d : new Date(a.created_at).getTime() - new Date(b.created_at).getTime() })
  let running = 0
  for (const t of sortedAsc) { running += t.type === 'income' ? Number(t.amount) : -Number(t.amount); balanceMap.set(t.id, running) }

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
  const hasFilters = search || filterType !== 'all' || filterAccount || filterCategory

  if (loading) return <div className="flex items-center justify-center h-full pt-14 lg:pt-0"><p className="text-slate-400 text-sm">Cargando...</p></div>

  return (
    <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-5xl">

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Movimientos</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-slate-500 text-sm">{filtered.length} de {txs.length} movimiento{txs.length !== 1 ? 's' : ''}</p>
            {filtered.length > 0 && (
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${running >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                Saldo: ${fmt(running)}
              </span>
            )}
          </div>
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
        <AppSelect value={filterType} onChange={v => setFilterType(v as 'all' | 'income' | 'expense')} className="w-32">
          <option value="all">Todos</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </AppSelect>
        <AppSelect value={filterAccount} onChange={setFilterAccount} className="w-44">
          <option value="">Todas las cuentas</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
        </AppSelect>
        <AppSelect value={filterCategory} onChange={setFilterCategory} className="w-44">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </AppSelect>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(''); setFilterType('all'); setFilterAccount(''); setFilterCategory('') }}>
            <X className="h-4 w-4 mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* Lista */}
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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(t.category as any)?.name && <Badge variant="outline" className="text-xs h-5">{(t.category as any).icon} {(t.category as any).name}</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">{format(new Date(t.date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}</span>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(t.account as any)?.name && <span className="text-xs text-slate-400">· {(t.account as any).emoji} {(t.account as any).name}</span>}
                  {t.description && <span className="text-xs text-slate-400 truncate">· {t.description}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-base font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'income' ? '+' : '-'}${fmt(Number(t.amount))}
                </p>
                <p className={`text-xs font-medium ${(balanceMap.get(t.id) ?? 0) >= 0 ? 'text-slate-500' : 'text-red-400'}`}>
                  Saldo: ${fmt(balanceMap.get(t.id) ?? 0)}
                </p>
              </div>
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

      {/* ===== Diálogo crear/editar movimiento ===== */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">

            {/* Tipo */}
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

            {/* Título */}
            <div>
              <Label>
                Título{!form.category_id && ' *'}
                {form.category_id && !form.title.trim() && (
                  <span className="ml-2 text-xs font-normal text-slate-400">(se usará la categoría)</span>
                )}
              </Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ej. Supermercado" className="mt-1" />
            </div>

            {/* Monto + Fecha */}
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

            {/* Cuenta */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Cuenta *</Label>
                <button type="button" onClick={() => setQAccOpen(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  <Plus className="w-3 h-3" />Nueva cuenta
                </button>
              </div>
              <AppSelect value={form.account_id} onChange={v => setForm(f => ({ ...f, account_id: v }))} className="w-full">
                {accounts.length === 0
                  ? <option value="" disabled>No hay cuentas. Creá una primero.</option>
                  : <>
                      <option value="">Seleccionar cuenta</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
                    </>}
              </AppSelect>
            </div>

            {/* Categoría */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>
                  Categoría{!form.category_id && !form.title.trim() ? ' *' : ' (opcional)'}
                </Label>
                <button type="button" onClick={() => setQCatOpen(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  <Plus className="w-3 h-3" />Nueva categoría
                </button>
              </div>
              <AppSelect value={form.category_id} onChange={v => setForm(f => ({ ...f, category_id: v }))} className="w-full">
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </AppSelect>
            </div>

            {/* Descripción */}
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

      {/* ===== Quick-create: nueva cuenta ===== */}
      <Dialog open={qAccOpen} onOpenChange={setQAccOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva cuenta rápida</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={qAccForm.name} onChange={e => setQAccForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Efectivo" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ACCT_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setQAccForm(f => ({ ...f, emoji: e }))}
                    className={`text-xl p-1.5 rounded-lg border-2 ${qAccForm.emoji === e ? 'border-slate-700 bg-slate-100' : 'border-transparent hover:border-slate-200'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setQAccForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-[3px] transition-transform ${qAccForm.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQAccOpen(false)}>Cancelar</Button>
            <Button onClick={quickSaveAccount}>Crear y seleccionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Quick-create: nueva categoría ===== */}
      <Dialog open={qCatOpen} onOpenChange={setQCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva categoría rápida</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={qCatForm.name} onChange={e => setQCatForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Supermercado" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {CAT_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setQCatForm(f => ({ ...f, icon: e }))}
                    className={`text-xl p-1.5 rounded-lg border-2 ${qCatForm.icon === e ? 'border-slate-700 bg-slate-100' : 'border-transparent hover:border-slate-200'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setQCatForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-[3px] transition-transform ${qCatForm.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <AppSelect value={qCatForm.type} onChange={v => setQCatForm(f => ({ ...f, type: v as CategoryType }))} className="mt-1 w-full">
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
                <option value="both">Ambos</option>
              </AppSelect>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQCatOpen(false)}>Cancelar</Button>
            <Button onClick={quickSaveCategory}>Crear y seleccionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Diálogo eliminar ===== */}
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

      {/* ===== Diálogo PDF ===== */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Exportar PDF</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Desde</Label><Input value={pdfFrom} onChange={e => setPdfFrom(e.target.value)} type="date" className="mt-1" /></div>
            <div><Label>Hasta</Label><Input value={pdfTo} onChange={e => setPdfTo(e.target.value)} type="date" className="mt-1" /></div>
            <p className="text-xs text-slate-400">
              {txs.filter(t => { const d = new Date(t.date + 'T12:00:00'); const f = new Date(pdfFrom + 'T00:00:00'); const to = new Date(pdfTo + 'T23:59:59'); return d >= f && d <= to }).length} movimientos en el rango seleccionado.
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
