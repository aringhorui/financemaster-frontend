import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { api } from '../api'
import { Drawer, PageHeader } from '../components/Layout'
import { categoryColor, fmt, nowLocalInput, toBackendDateTime, toLocalInput } from '../format'
import { useAction } from '../useAsync'

const PAGE_SIZE = 20

export default function Expenses() {
  const { busy, error, run } = useAction()
  const [lookups, setLookups] = useState({ categories: [], subcategories: [], paymentMethods: [], bankAccounts: [] })
  const [data, setData] = useState({ expenses: [], page: 0, totalPages: 0, totalElements: 0 })
  // Filters live in the URL so charts can link straight to a filtered list (e.g. /expenses?from=…&categoryId=…)
  const [params, setParams] = useSearchParams()
  const filters = {
    categoryId: params.get('categoryId') || '',
    subCategoryId: params.get('subCategoryId') || '',
    startDate: params.get('from') || '',
    endDate: params.get('to') || '',
    q: params.get('q') || '',
  }
  const page = Number(params.get('page') || 0)
  const setPage = (p) => setParams((prev) => { const n = new URLSearchParams(prev); if (p) n.set('page', p); else n.delete('page'); return n })
  const setFilters = (f) => {
    const n = new URLSearchParams()
    if (f.categoryId) n.set('categoryId', f.categoryId)
    if (f.subCategoryId) n.set('subCategoryId', f.subCategoryId)
    if (f.startDate) n.set('from', f.startDate)
    if (f.endDate) n.set('to', f.endDate)
    if (f.q) n.set('q', f.q)
    setParams(n)
  }
  const [editing, setEditing] = useState(null) // null = closed, {} = new, expense = edit

  useEffect(() => {
    run(async () => {
      const [categories, subcategories, pm, ba] = await Promise.all([
        api.categories.list(),
        api.subcategories.list(),
        api.paymentMethods.list(),
        api.bankAccounts.list(),
      ])
      setLookups({
        categories,
        subcategories,
        paymentMethods: pm.paymentMethods || [],
        bankAccounts: ba.bankAccounts || [],
      })
    })
  }, [run])

  const load = useCallback(
    () =>
      run(async () => {
        const res = await api.expenses.list({
          categoryId: filters.categoryId,
          subCategoryId: filters.subCategoryId,
          startDate: filters.startDate && `${filters.startDate}T00:00:00`,
          endDate: filters.endDate && `${filters.endDate}T23:59:59`,
          q: filters.q,
          page,
          pageSize: PAGE_SIZE,
        })
        setData(res)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, params],
  )

  useEffect(() => {
    load()
  }, [load])

  const setFilter = (k) => (e) => {
    const next = { ...filters, [k]: e.target.value }
    if (k === 'categoryId') next.subCategoryId = ''
    setFilters(next)
  }

  const remove = (exp) => {
    if (!confirm(`Delete expense of ${fmt(exp.amount)}?`)) return
    run(async () => {
      await api.expenses.remove(exp.transactionId)
      await load()
    })
  }

  const pageTotal = data.expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const largest = data.expenses.reduce((m, e) => (e.amount > (m?.amount ?? 0) ? e : m), null)

  return (
    <>
      <PageHeader title="Expenses" subtitle="Every transaction, newest first.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="icon-btn" onClick={() => run(() => exportCsv(filters))} disabled={busy || !data.totalElements} title="Download the filtered expenses as a CSV file">
            <Download size={15} /> Export CSV
          </button>
          <Link to="/expenses/import"><button className="secondary">Import</button></Link>
          <button onClick={() => setEditing({})}>Add expense</button>
        </div>
      </PageHeader>
      {error && <div className="error">{error}</div>}

      <div className="stats">
        <div className="stat"><div className="label">Spent on this page</div><div className="value">{fmt(pageTotal)}</div></div>
        <div className="stat"><div className="label">Matching transactions</div><div className="value">{data.totalElements}</div></div>
        <div className="stat"><div className="label">Largest on this page</div><div className="value">{largest ? fmt(largest.amount) : '—'}</div></div>
      </div>

      {editing && (
        <ExpenseForm
          expense={editing}
          lookups={lookups}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}

      <div className="card">
        <form className="row" onSubmit={(e) => e.preventDefault()}>
          <SearchBox value={filters.q} onChange={(q) => setFilters({ ...filters, q })} />
          <label>Category
            <select value={filters.categoryId} onChange={setFilter('categoryId')}>
              <option value="">All</option>
              {lookups.categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
            </select>
          </label>
          <label>Subcategory
            <select value={filters.subCategoryId} onChange={setFilter('subCategoryId')}>
              <option value="">All</option>
              {lookups.subcategories
                .filter((s) => !filters.categoryId || s.categoryId === filters.categoryId)
                .map((s) => <option key={s.subcategoryId} value={s.subcategoryId}>{s.subcategoryName}</option>)}
            </select>
          </label>
          <label>From<input type="date" value={filters.startDate} onChange={setFilter('startDate')} /></label>
          <label>To<input type="date" value={filters.endDate} onChange={setFilter('endDate')} /></label>
          <button type="button" className="secondary" onClick={() => setFilters({ categoryId: '', subCategoryId: '', startDate: '', endDate: '', q: '' })}>
            Clear
          </button>
        </form>
        <p className="hint">Filters combine. Charts on the Overview open this list already filtered.</p>
      </div>

      <div className="card flush table-wrap">
        <table className="responsive">
          <thead>
            <tr>
              <th>Date</th><th>Category</th><th>Payment</th><th>Account</th><th>Notes</th>
              <th className="num">Amount</th><th />
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((e) => (
              <tr key={e.transactionId}>
                <td className="meta">{new Date(e.transactionDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="primary"><div className="cat-cell"><span className="dot" style={{ background: categoryColor(e.categoryName) }} /><div>{e.categoryName}<div className="muted" style={{ fontSize: '0.8rem' }}>{e.subCategoryName}</div></div></div></td>
                <td data-label="Paid with">{e.paymentMethodName}</td>
                <td data-label="Account">{e.bankAccountName || '—'}</td>
                <td className="meta-notes">{e.notes}</td>
                <td className="num amount">{fmt(e.amount)}</td>
                <td className="actions">
                  <button className="secondary small" onClick={() => setEditing(e)}>Edit</button>
                  <button className="danger small" disabled={busy} onClick={() => remove(e)}>Delete</button>
                </td>
              </tr>
            ))}
            {data.expenses.length === 0 && (
              <tr><td colSpan={7} className="empty">{busy ? 'Loading…' : 'No expenses match. Change the filters or add an expense.'}</td></tr>
            )}
          </tbody>
          {data.expenses.length > 0 && (
            <tfoot>
              <tr><td colSpan={5} className="muted">Page total</td><td className="num"><strong>{fmt(pageTotal)}</strong></td><td /></tr>
            </tfoot>
          )}
        </table>
        <div className="pager">
          <span className="grow">{data.totalElements} expenses</span>
          <button className="secondary small" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {data.totalPages ? page + 1 : 0} of {data.totalPages}</span>
          <button className="secondary small" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </>
  )
}

function ExpenseForm({ expense, lookups, onCancel, onSaved }) {
  const isEdit = !!expense.transactionId
  const { busy, error, run } = useAction()
  const [form, setForm] = useState({
    transactionDate: isEdit ? toLocalInput(expense.transactionDate) : nowLocalInput(),
    amount: expense.amount ?? '',
    categoryId: expense.categoryId ?? '',
    subCategoryId: expense.subCategoryId ?? '',
    paymentMethodId: expense.paymentMethodId ?? '',
    bankAccountId: expense.bankAccountId ?? '',
    notes: expense.notes ?? '',
  })

  const set = (k) => (e) => {
    const next = { ...form, [k]: e.target.value }
    if (k === 'categoryId') next.subCategoryId = ''
    setForm(next)
  }

  const submit = (e) => {
    e.preventDefault()
    const body = {
      transactionDate: toBackendDateTime(form.transactionDate),
      amount: Number(form.amount),
      categoryId: form.categoryId,
      subCategoryId: form.subCategoryId,
      paymentMethodId: form.paymentMethodId,
      bankAccountId: form.bankAccountId || null,
      notes: form.notes,
    }
    run(async () => {
      if (isEdit) {
        await api.expenses.edit({
          ...body,
          transactionId: expense.transactionId,
          clearBankAccount: !form.bankAccountId && !!expense.bankAccountId,
        })
      } else {
        await api.expenses.create(body)
      }
      await onSaved()
    })
  }

  const subs = lookups.subcategories.filter((s) => s.categoryId === form.categoryId)

  return (
    <Drawer
      title={isEdit ? 'Edit expense' : 'New expense'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" form="expense-form" disabled={busy}>{isEdit ? 'Save changes' : 'Add expense'}</button>
        </>
      }
    >
      {error && <div className="error">{error}</div>}
      <form id="expense-form" className="stack" onSubmit={submit}>
        <label>Date and time<input type="datetime-local" required max={nowLocalInput()} value={form.transactionDate} onChange={set('transactionDate')} /></label>
        <label>Amount<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={set('amount')} /></label>
        <label>Category
          <select required value={form.categoryId} onChange={set('categoryId')}>
            <option value="" disabled>Select a category</option>
            {lookups.categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
          </select>
        </label>
        <label>Subcategory
          <select required value={form.subCategoryId} onChange={set('subCategoryId')} disabled={!form.categoryId}>
            <option value="" disabled>{form.categoryId && !subs.length ? 'Add a subcategory first' : 'Select a subcategory'}</option>
            {subs.map((s) => <option key={s.subcategoryId} value={s.subcategoryId}>{s.subcategoryName}</option>)}
          </select>
        </label>
        <label>Payment method
          <select required value={form.paymentMethodId} onChange={set('paymentMethodId')}>
            <option value="" disabled>Select a payment method</option>
            {lookups.paymentMethods.map((p) => <option key={p.paymentMethodId} value={p.paymentMethodId}>{p.paymentMethodName}</option>)}
          </select>
        </label>
        <label>Bank account (optional)
          <select value={form.bankAccountId} onChange={set('bankAccountId')}>
            <option value="">None</option>
            {lookups.bankAccounts.map((b) => <option key={b.bankAccountId} value={b.bankAccountId}>{b.bankAccountName}</option>)}
          </select>
        </label>
        <label>Notes (optional)<input value={form.notes} onChange={set('notes')} /></label>
      </form>
    </Drawer>
  )
}

function SearchBox({ value, onChange }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  // Wait for a pause in typing before filtering
  useEffect(() => {
    if (text === value) return undefined
    const t = setTimeout(() => onChange(text.trim()), 350)
    return () => clearTimeout(t)
  }, [text, value, onChange])
  return (
    <label className="search-box" aria-label="Search descriptions">
      <Search size={15} />
      <input type="search" placeholder="Search descriptions" value={text} onChange={(e) => setText(e.target.value)} />
    </label>
  )
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Downloads every expense matching the filters (all pages) as a CSV file. */
async function exportCsv(filters) {
  const rows = []
  for (let page = 0; page < 100; page++) {
    const res = await api.expenses.list({
      categoryId: filters.categoryId,
      subCategoryId: filters.subCategoryId,
      startDate: filters.startDate && `${filters.startDate}T00:00:00`,
      endDate: filters.endDate && `${filters.endDate}T23:59:59`,
      q: filters.q,
      page,
      pageSize: 100,
    })
    rows.push(...res.expenses)
    if (page + 1 >= res.totalPages) break
  }
  const header = ['Date', 'Time', 'Amount', 'Category', 'Subcategory', 'Payment method', 'Bank account', 'Notes']
  const lines = rows.map((e) => [
    e.transactionDate.slice(0, 10), e.transactionDate.slice(11, 16), e.amount, e.categoryName, e.subCategoryName,
    e.paymentMethodName, e.bankAccountName || '', e.notes || '',
  ].map(csvCell).join(','))
  const blob = new Blob(['\ufeff' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expenses-${filters.startDate || 'all'}${filters.endDate ? `-to-${filters.endDate}` : ''}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
