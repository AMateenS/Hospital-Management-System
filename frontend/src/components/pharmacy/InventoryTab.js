'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, Field, Modal } from '@/components/ui';

const blank = { name: '', genericName: '', category: '', strength: '', manufacturer: '', batchNo: '', expiryDate: '', purchasePrice: '', sellingPrice: '', quantity: '', minStock: 10 };
const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '-');

export default function InventoryTab({ onChanged, initialFilter = '' }) {
  const [rows, setRows] = useState([]); const [filter, setFilter] = useState(initialFilter); const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null); const [f, setF] = useState(blank); const [fErr, setFErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = useCallback(() => api('/pharmacy/medicines', { query: { filter } }).then(setRows).catch((e) => setErr(e.message)), [filter]);
  useEffect(() => { load(); }, [load]);

  const now = new Date(); const soon = new Date(Date.now() + 60 * 864e5);
  const alerts = (m) => [m.expiryDate && new Date(m.expiryDate) < now && ['Expired', 'bg-red-50 text-red-700'], m.expiryDate && new Date(m.expiryDate) >= now && new Date(m.expiryDate) <= soon && ['Expiring soon', 'bg-amber-50 text-amber-700'], m.quantity <= m.minStock && ['Low stock', 'bg-red-50 text-red-700']].filter(Boolean);

  const openNew = () => { setF(blank); setEdit('new'); setFErr(''); };
  const openEdit = (m) => { setF({ ...blank, ...m, expiryDate: m.expiryDate ? m.expiryDate.slice(0, 10) : '' }); setEdit(m); setFErr(''); };
  async function save(e) {
    e.preventDefault(); setBusy(true); setFErr('');
    const { _id, createdAt, updatedAt, __v, ...body } = f;
    try { await api(edit === 'new' ? '/pharmacy/medicines' : `/pharmacy/medicines/${edit._id}`, { method: edit === 'new' ? 'POST' : 'PUT', body }); setEdit(null); load(); onChanged(); }
    catch (x) { setFErr(x.errors?.map((i) => `${i.field}: ${i.message}`).join('; ') || x.message); } finally { setBusy(false); }
  }
  const del = async (m) => { if (confirm(`Delete ${m.name} ${m.strength || ''} (batch ${m.batchNo || '-'})?`)) { try { await api(`/pharmacy/medicines/${m._id}`, { method: 'DELETE' }); load(); onChanged(); } catch (x) { setErr(x.message); } } };

  const cols = [
    { key: 'name', header: 'Medicine', render: (m) => <div><p className="font-medium">{m.name} {m.strength}</p><p className="text-xs text-slate-500">{m.genericName}</p></div> },
    { key: 'category', header: 'Category' }, { key: 'manufacturer', header: 'Manufacturer' }, { key: 'batchNo', header: 'Batch' },
    { key: 'expiryDate', header: 'Expiry', render: (m) => fmt(m.expiryDate) },
    { key: 'quantity', header: 'Stock', render: (m) => <span className={m.quantity <= m.minStock ? 'font-semibold text-red-600' : ''}>{m.quantity} <span className="text-xs text-slate-400">/ min {m.minStock}</span></span> },
    { key: 'sellingPrice', header: 'Price', render: (m) => `${m.sellingPrice} (cost ${m.purchasePrice})` },
    { key: 'al', header: 'Alerts', render: (m) => <div className="flex flex-wrap gap-1">{alerts(m).map(([t, c]) => <Badge key={t} tone={c}>{t}</Badge>)}</div> },
    { key: 'a', header: '', render: (m) => <div className="flex gap-2"><Button variant="outline" onClick={() => openEdit(m)}>Edit</Button><Button variant="ghost" onClick={() => del(m)}>Delete</Button></div> },
  ];
  return (
    <Card title="Medicine inventory" action={<Button onClick={openNew}><Plus className="h-4 w-4" />Add medicine</Button>}>
      {err && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <DataTable columns={cols} rows={rows} searchKeys={['name', 'genericName', 'category', 'batchNo', 'manufacturer']} empty="No medicines"
        filters={<select className="input w-48" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All medicines</option><option value="low">Low stock</option><option value="expired">Expired</option><option value="expiring">Expiring in 60 days</option></select>} />
      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit === 'new' ? 'Add medicine' : 'Edit medicine'}>
        <form onSubmit={save} className="space-y-4">
          {fErr && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fErr}</div>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Medicine name" required><input required className="input" value={f.name} onChange={set('name')} /></Field>
            <Field label="Generic name"><input className="input" value={f.genericName || ''} onChange={set('genericName')} /></Field>
            <Field label="Category"><input className="input" value={f.category || ''} onChange={set('category')} /></Field>
            <Field label="Strength"><input className="input" placeholder="500mg" value={f.strength || ''} onChange={set('strength')} /></Field>
            <Field label="Manufacturer"><input className="input" value={f.manufacturer || ''} onChange={set('manufacturer')} /></Field>
            <Field label="Batch number"><input className="input" value={f.batchNo || ''} onChange={set('batchNo')} /></Field>
            <Field label="Expiry date" required><input type="date" required className="input" value={f.expiryDate} onChange={set('expiryDate')} /></Field>
            <Field label="Purchase price" required><input type="number" step="0.01" min="0" required className="input" value={f.purchasePrice} onChange={set('purchasePrice')} /></Field>
            <Field label="Selling price" required><input type="number" step="0.01" min="0" required className="input" value={f.sellingPrice} onChange={set('sellingPrice')} /></Field>
            <Field label="Available quantity" required><input type="number" min="0" required className="input" value={f.quantity} onChange={set('quantity')} /></Field>
            <Field label="Minimum stock level"><input type="number" min="0" className="input" value={f.minStock} onChange={set('minStock')} /></Field>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" loading={busy}>Save medicine</Button></div>
        </form>
      </Modal>
    </Card>
  );
}
