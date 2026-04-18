'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, CategoryType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const EMOJIS = ['📁','🏠','🚗','🍔','👕','💊','🎮','✈️','📚','💡','🎁','🏋️','🎵','💼','🛒','🏥','🐾','🌿','🎨','⚽']
const COLORS = ['#6b7280','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16']

interface Form { name: string; icon: string; color: string; type: CategoryType }
const blank: Form = { name: '', icon: '📁', color: '#6b7280', type: 'both' }

const typeMap: Record<CategoryType, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  income: { label: 'Ingreso', variant: 'default' },
  expense: { label: 'Gasto', variant: 'destructive' },
  both: { label: 'Ambos', variant: 'secondary' },
}

export default function CategoriasPage() {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [delTarget, setDelTarget] = useState<Category | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const supabase = createClient()

  useEffect(() => {
    load()
    const ch = supabase.channel('categorias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('categories').select('*').eq('user_id', user.id).order('name')
    setCats(data || [])
    setLoading(false)
  }

  function openCreate() { setEditing(null); setForm(blank); setOpen(true) }
  function openEdit(c: Category) { setEditing(c); setForm({ name: c.name, icon: c.icon, color: c.color, type: c.type }); setOpen(true) }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    const payload = { name: form.name.trim(), icon: form.icon, color: form.color, type: form.type }
    const { error } = editing
      ? await supabase.from('categories').update(payload).eq('id', editing.id)
      : await supabase.from('categories').insert({ ...payload, user_id: user.id })
    if (error) { toast.error('Error al guardar'); return }
    toast.success(editing ? 'Categoría actualizada' : 'Categoría creada')
    setOpen(false); load()
  }

  async function remove() {
    if (!delTarget) return
    const { error } = await supabase.from('categories').delete().eq('id', delTarget.id)
    if (error) { toast.error('Error al eliminar'); return }
    toast.success('Categoría eliminada')
    setDelOpen(false); setDelTarget(null); load()
  }

  if (loading) return <div className="flex items-center justify-center h-full pt-14 lg:pt-0"><p className="text-slate-400 text-sm">Cargando...</p></div>

  return (
    <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Categorías</h1>
          <p className="text-slate-500 text-sm">{cats.length} categoría{cats.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva categoría</Button>
      </div>

      {cats.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-5xl mb-4">🏷️</div>
            <p className="text-slate-600 font-medium mb-2">No hay categorías todavía</p>
            <p className="text-slate-400 text-sm mb-4">Crea categorías para organizar tus movimientos</p>
            <Button onClick={openCreate}>Crear categoría</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3.5 bg-white rounded-xl border hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: c.color + '20' }}>
                  {c.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <Badge variant={typeMap[c.type].variant} className="text-xs mt-0.5">{typeMap[c.type].label}</Badge>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 shrink-0 hover:bg-accent transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => { setDelTarget(c); setDelOpen(true) }}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Alimentación" className="mt-1" />
            </div>
            <div>
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setForm(f => ({ ...f, icon: e }))}
                    className={`text-xl p-1.5 rounded-lg border-2 transition-all ${form.icon === e ? 'border-slate-700 bg-slate-100' : 'border-transparent hover:border-slate-200'}`}>
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
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as CategoryType }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
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
          <DialogHeader><DialogTitle>Eliminar categoría</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">¿Eliminar <strong>{delTarget?.name}</strong>? Los movimientos con esta categoría la perderán.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
