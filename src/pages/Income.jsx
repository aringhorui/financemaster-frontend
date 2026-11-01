import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Drawer, PageHeader } from '../components/Layout'
import { fmt } from '../format'
import { useAction } from '../useAsync'
import { cycleDates, cycleOf, monthRange } from './overview/shared'

const SOURCES = ['Salary', 'Bonus', 'Freelance', 'Business', 'Interest', 'Dividends', 'Rent received', 'Refund', 'Gift']

const todayIso = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export default function Income() {
  const { busy, error, run } = useAction()
  const [month, setMonth] = useState(() => cycleOf())
  const [data, setData] = useState({ total: 0, incomes: [] })
  const [accounts, setAccounts] = useState([])
  const [editing, setEditing] = useState(null)
  const { from, to } = monthRange(month)
  const label = new Date(month.y, month.m, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  useEffect(() => {
    run(async () => setAccounts((await api.bankAccounts.list()).bankAccounts || []))
  }, [run])

  const load = useCallback(() => run(async () => setData(await api.income.list(from, to))), [run, from, to])

  useEffect(() => {
    load()
  }, [load])

  const shift = (delta) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  const remove = (i) => {
    if (!confirm(`Delete ${i.source} income of ${fmt(i.amount)}?`)) return
    run(async () => {
      await api.income.remove(i.incomeId)
      await load()
    })
  }

  const bySource = Object.entries(
    data.incomes.reduce((acc, i) => ({ ...acc, [i.source]: (acc[i.source] || 0) + i.amount }), {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <>
      <PageHeader title="Income" subtitle="Money coming in. Used to work out how much you save each month.">
        <button onClick={() => setEditing({})}>Add income</button>
      </PageHeader>
      {error && <div className="error">{error}</div>}

      <div className="income-bar">
        <div className="month-switch">
          <button className="secondary small" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <strong>{label}</strong>
          <span className="muted">{cycleDates(month)}</span>
          <button className="secondary small" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
        <div className="income-total">
          <span className="muted">Total</span>
          <span className="fig">{fmt(data.total)}</span>
        </div>
        <div className="income-sources">
          {bySource.map(([s, v]) => (
            <span key={s} className="tag">{s} {fmt(v).replace('.00', '')}</span>
          ))}
        </div>
      </div>

      {editing && (
        <IncomeForm
          income={editing}
          accounts={accounts}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}

      <div className="card flush table-wrap">
        <table className="responsive">
          <thead>
            <tr><th>Date</th><th>Source</th><th>Account</th><th>Notes</th><th className="num">Amount</th><th /></tr>
          </thead>
          <tbody>
            {data.incomes.map((i) => (
              <tr key={i.incomeId}>
                <td className="meta">{new Date(i.receivedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="primary">{i.source}</td>
                <td data-label="Account">{i.bankAccountName || '—'}</td>
                <td className="meta-notes">{i.notes}</td>
                <td className="num amount pos">{fmt(i.amount)}</td>
                <td className="actions">
                  <button className="secondary small" onClick={() => setEditing(i)}>Edit</button>
                  <button className="danger small" disabled={busy} onClick={() => remove(i)}>Delete</button>
                </td>
              </tr>
            ))}
            {!data.incomes.length && (
              <tr><td colSpan={6} className="empty">{busy ? 'Loading…' : `No income recorded for ${label}. Add your salary or other income to see your savings rate.`}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function IncomeForm({ income, accounts, onCancel, onSaved }) {
  const isEdit = !!income.incomeId
  const { busy, error, run } = useAction()
  const [form, setForm] = useState({
    amount: income.amount ?? '',
    receivedDate: income.receivedDate ?? todayIso(),
    source: income.source ?? '',
    bankAccountId: income.bankAccountId ?? '',
    notes: income.notes ?? '',
  })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const body = {
      amount: Number(form.amount),
      receivedDate: form.receivedDate,
      source: form.source,
      bankAccountId: form.bankAccountId || null,
      notes: form.notes,
    }
    run(async () => {
      if (isEdit) {
        await api.income.edit({ ...body, incomeId: income.incomeId, clearBankAccount: !form.bankAccountId && !!income.bankAccountId })
      } else {
        await api.income.add(body)
      }
      await onSaved()
    })
  }

  return (
    <Drawer
      title={isEdit ? 'Edit income' : 'New income'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" form="income-form" disabled={busy}>{isEdit ? 'Save changes' : 'Add income'}</button>
        </>
      }
    >
      {error && <div className="error">{error}</div>}
      <form id="income-form" className="stack" onSubmit={submit}>
        <label>Amount<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={set('amount')} /></label>
        <label>Date received<input type="date" required max={todayIso()} value={form.receivedDate} onChange={set('receivedDate')} /></label>
        <label>Source
          <input required list="income-sources" placeholder="e.g. Salary" value={form.source} onChange={set('source')} />
          <datalist id="income-sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label>Bank account (optional)
          <select value={form.bankAccountId} onChange={set('bankAccountId')}>
            <option value="">None</option>
            {accounts.map((a) => <option key={a.bankAccountId} value={a.bankAccountId}>{a.bankAccountName}</option>)}
          </select>
        </label>
        <label>Notes (optional)<input value={form.notes} onChange={set('notes')} /></label>
      </form>
    </Drawer>
  )
}
