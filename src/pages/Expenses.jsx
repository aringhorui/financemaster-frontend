import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Search, SlidersHorizontal, X } from 'lucide-react'
import { api } from '../api'
import { Drawer, PageHeader } from '../components/Layout'
import { categoryColor, fmt, nowLocalInput, toBackendDateTime, toLocalInput } from '../format'
import { useAction } from '../useAsync'
import { cycleOf, isoDate, monthRange, parseIso } from './overview/shared'

const PAGE_SIZE = 20

// Filter field -> URL parameter. Filters live in the URL so charts and bookmarks can link to a filtered list.
const FILTER_PARAMS = {
  q: 'q',
  categoryId: 'categoryId',
  subCategoryId: 'subCategoryId',
  paymentMethodId: 'paymentMethodId',
  bankAccountId: 'bankAccountId',
  minAmount: 'min',
  maxAmount: 'max',
  startDate: 'from',
  endDate: 'to',
}
const EMPTY_FILTERS = Object.fromEntries(Object.keys(FILTER_PARAMS).map((k) => [k, '']))
const MORE_FILTERS = ['categoryId', 'subCategoryId', 'paymentMethodId', 'bankAccountId', 'minAmount', 'maxAmount']

/** Filters as API query parameters. */
const toQuery = (f) => ({
  q: f.q,
  categoryId: f.categoryId,
  subCategoryId: f.subCategoryId,
  paymentMethodId: f.paymentMethodId,
  bankAccountId: f.bankAccountId,
  minAmount: f.minAmount,
  maxAmount: f.maxAmount,
  startDate: f.startDate && `${f.startDate}T00:00:00`,
  endDate: f.endDate && `${f.endDate}T23:59:59`,
})

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Expenses() {
  const { busy, error, run } = useAction()
  const [lookups, setLookups] = useState({ categories: [], subcategories: [], paymentMethods: [], bankAccounts: [] })
  const [data, setData] = useState({ expenses: [], page: 0, totalPages: 0, totalElements: 0 })
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(Object.entries(FILTER_PARAMS).map(([k, param]) => [k, params.get(param) || '']))
  const page = Number(params.get('page') || 0)
  const setPage = (p) => setParams((prev) => { const n = new URLSearchParams(prev); if (p) n.set('page', p); else n.delete('page'); return n })
  const setFilters = (f) => {
    const n = new URLSearchParams()
    Object.entries(FILTER_PARAMS).forEach(([k, param]) => f[k] && n.set(param, f[k]))
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
        const res = await api.expenses.list({ ...toQuery(filters), page, pageSize: PAGE_SIZE })
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
  const matchingTotal = data.totalAmount ?? pageTotal
  const activeMore = MORE_FILTERS.filter((k) => filters[k]).length
  const [showMore, setShowMore] = useState(activeMore > 0)

  const nameOf = (list, idKey, nameKey, id) => list.find((x) => x[idKey] === id)?.[nameKey] ?? '…'
  const chips = [
    filters.q && { keys: ['q'], label: `“${filters.q}”` },
    filters.categoryId && { keys: ['categoryId', 'subCategoryId'], label: `Category: ${nameOf(lookups.categories, 'categoryId', 'categoryName', filters.categoryId)}` },
    filters.subCategoryId && { keys: ['subCategoryId'], label: `Subcategory: ${nameOf(lookups.subcategories, 'subcategoryId', 'subcategoryName', filters.subCategoryId)}` },
    filters.paymentMethodId && { keys: ['paymentMethodId'], label: `Paid with: ${nameOf(lookups.paymentMethods, 'paymentMethodId', 'paymentMethodName', filters.paymentMethodId)}` },
    filters.bankAccountId && { keys: ['bankAccountId'], label: `Account: ${filters.bankAccountId === 'none' ? 'None' : nameOf(lookups.bankAccounts, 'bankAccountId', 'bankAccountName', filters.bankAccountId)}` },
    (filters.minAmount || filters.maxAmount) && {
      keys: ['minAmount', 'maxAmount'],
      label: filters.minAmount && filters.maxAmount ? `${fmt(+filters.minAmount)} – ${fmt(+filters.maxAmount)}` : filters.minAmount ? `At least ${fmt(+filters.minAmount)}` : `Up to ${fmt(+filters.maxAmount)}`,
    },
    (filters.startDate || filters.endDate) && {
      keys: ['startDate', 'endDate'],
      label: filters.startDate && filters.endDate ? `${shortDate(filters.startDate)} – ${shortDate(filters.endDate)}` : filters.startDate ? `From ${shortDate(filters.startDate)}` : `Until ${shortDate(filters.endDate)}`,
    },
  ].filter(Boolean)
  const clearKeys = (keys) => setFilters({ ...filters, ...Object.fromEntries(keys.map((k) => [k, ''])) })

  const today = new Date()
  const current = monthRange(cycleOf())
  const dayBeforeCycle = parseIso(current.from)
  dayBeforeCycle.setDate(dayBeforeCycle.getDate() - 1)
  const previous = monthRange(cycleOf(dayBeforeCycle))
  const last30 = new Date(today)
  last30.setDate(last30.getDate() - 29)
  const presets = [
    { label: 'This cycle', from: current.from, to: current.to },
    { label: 'Last cycle', from: previous.from, to: previous.to },
    { label: 'Last 30 days', from: isoDate(last30), to: isoDate(today) },
  ]

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
        <div className="stat"><div className="label">Total of matching expenses</div><div className="value">{fmt(matchingTotal)}</div></div>
        <div className="stat"><div className="label">Matching expenses</div><div className="value">{data.totalElements}</div></div>
        <div className="stat"><div className="label">Average expense</div><div className="value">{data.totalElements ? fmt(matchingTotal / data.totalElements) : '—'}</div></div>
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

      <div className="card filters">
        <form className="row" onSubmit={(e) => e.preventDefault()}>
          <DebouncedInput className="search-box" icon={<Search size={15} />} type="search" placeholder="Search descriptions" ariaLabel="Search descriptions" value={filters.q} onChange={(q) => setFilters({ ...filters, q })} />
          <label>From<input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={setFilter('startDate')} /></label>
          <label>To<input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={setFilter('endDate')} /></label>
          <button type="button" className={`icon-btn${showMore ? ' on' : ''}`} onClick={() => setShowMore(!showMore)} aria-expanded={showMore} aria-controls="more-filters">
            <SlidersHorizontal size={15} /> More filters{activeMore > 0 && <span className="count">{activeMore}</span>}
          </button>
        </form>

        <div className="presets" role="group" aria-label="Date presets">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`chip-btn${filters.startDate === p.from && filters.endDate === p.to ? ' on' : ''}`}
              onClick={() => setFilters({ ...filters, startDate: p.from, endDate: p.to })}
            >
              {p.label}
            </button>
          ))}
        </div>

        {showMore && (
          <form id="more-filters" className="row more-filters" onSubmit={(e) => e.preventDefault()}>
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
                  .filter((sc) => !filters.categoryId || sc.categoryId === filters.categoryId)
                  .map((sc) => <option key={sc.subcategoryId} value={sc.subcategoryId}>{sc.subcategoryName}</option>)}
              </select>
            </label>
            <label>Payment method
              <select value={filters.paymentMethodId} onChange={setFilter('paymentMethodId')}>
                <option value="">All</option>
                {lookups.paymentMethods.map((m) => <option key={m.paymentMethodId} value={m.paymentMethodId}>{m.paymentMethodName}</option>)}
              </select>
            </label>
            <label>Bank account
              <select value={filters.bankAccountId} onChange={setFilter('bankAccountId')}>
                <option value="">All</option>
                <option value="none">No account</option>
                {lookups.bankAccounts.map((b) => <option key={b.bankAccountId} value={b.bankAccountId}>{b.bankAccountName}</option>)}
              </select>
            </label>
            <label>Min amount
              <DebouncedInput type="number" min="0" step="1" inputMode="decimal" placeholder="₹0" ariaLabel="Minimum amount" value={filters.minAmount} onChange={(v) => setFilters({ ...filters, minAmount: v })} />
            </label>
            <label>Max amount
              <DebouncedInput type="number" min="0" step="1" inputMode="decimal" placeholder="Any" ariaLabel="Maximum amount" value={filters.maxAmount} onChange={(v) => setFilters({ ...filters, maxAmount: v })} />
            </label>
          </form>
        )}

        {chips.length > 0 && (
          <div className="filter-chips" aria-label="Active filters">
            {chips.map((c) => (
              <button key={c.label} type="button" className="chip-btn on" onClick={() => clearKeys(c.keys)} aria-label={`Remove filter ${c.label}`}>
                {c.label} <X size={13} />
              </button>
            ))}
            <button type="button" className="linkish clear-all" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all</button>
          </div>
        )}
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

/** Input that waits for a pause in typing before reporting its value. */
function DebouncedInput({ value, onChange, icon, className, ariaLabel, ...rest }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (text === value) return undefined
    const t = setTimeout(() => onChange(text.trim()), 400)
    return () => clearTimeout(t)
  }, [text, value, onChange])
  const input = <input {...rest} aria-label={ariaLabel} value={text} onChange={(e) => setText(e.target.value)} />
  return icon ? <label className={className}>{icon}{input}</label> : input
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Downloads every expense matching the filters (all pages) as a CSV file. */
async function exportCsv(filters) {
  const rows = []
  for (let page = 0; page < 100; page++) {
    const res = await api.expenses.list({ ...toQuery(filters), page, pageSize: 100 })
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
