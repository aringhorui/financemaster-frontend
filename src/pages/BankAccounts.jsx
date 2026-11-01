import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../components/Layout'
import { useAction } from '../useAsync'
import { fmt } from '../format'

const emptyForm = { bankAccountName: '', isCreditCard: false, creditCycle: '', creditLimit: '' }

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const { busy, error, run } = useAction()

  const load = useCallback(
    () => run(async () => setAccounts((await api.bankAccounts.list()).bankAccounts || [])),
    [run],
  )

  useEffect(() => {
    load()
  }, [load])

  const add = (e) => {
    e.preventDefault()
    run(async () => {
      await api.bankAccounts.add({
        bankAccountName: form.bankAccountName,
        isCreditCard: form.isCreditCard,
        creditCycle: form.isCreditCard ? Number(form.creditCycle) : null,
        creditLimit: form.isCreditCard ? Number(form.creditLimit) : 0,
      })
      setForm(emptyForm)
      await load()
    })
  }

  return (
    <>
      <PageHeader title="Bank accounts" subtitle="Bank accounts and credit cards you spend from." />
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>New account</h3>
        <form className="row" onSubmit={add}>
          <label>Name<input required value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} /></label>
          <label className="check">
            <input type="checkbox" checked={form.isCreditCard} onChange={(e) => setForm({ ...form, isCreditCard: e.target.checked })} />
            Credit card
          </label>
          {form.isCreditCard && (
            <>
              <label>Billing day (1-31)<input type="number" min="1" max="31" required value={form.creditCycle} onChange={(e) => setForm({ ...form, creditCycle: e.target.value })} /></label>
              <label>Credit limit<input type="number" min="0.01" step="0.01" required value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} /></label>
            </>
          )}
          <button disabled={busy}>Add</button>
        </form>
      </div>

      <div className="card flush table-wrap">
        <table className="responsive">
          <thead>
            <tr><th>Name</th><th>Type</th><th className="num">Billing day</th><th className="num">Credit limit</th><th /></tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <Row key={a.bankAccountId} account={a} run={run} busy={busy} reload={load} />
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="empty">No accounts yet. Add one to link it to your expenses.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Row({ account, run, busy, reload }) {
  // GET does not return isCreditCard, so infer it from the credit cycle
  const isCredit = account.isCreditCard ?? account.creditCycle != null
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.bankAccountName)
  const [cycle, setCycle] = useState(account.creditCycle ?? '')
  const [limit, setLimit] = useState(account.creditLimit || '')
  const [credit, setCredit] = useState(isCredit)

  const startEdit = () => {
    setName(account.bankAccountName)
    setCycle(account.creditCycle ?? '')
    setLimit(account.creditLimit || '')
    setCredit(isCredit)
    setEditing(true)
  }

  const save = () =>
    run(async () => {
      if (credit && !(Number(cycle) >= 1 && Number(cycle) <= 31)) {
        throw new Error('Enter the billing day of the month (1 to 31) for the credit card.')
      }
      if (credit && !(Number(limit) > 0)) {
        throw new Error('Enter a credit limit above 0 for the credit card.')
      }
      await api.bankAccounts.edit({
        bankAccountId: account.bankAccountId,
        newBankAccountName: name,
        newIsCreditCard: credit,
        newCreditCycle: credit ? Number(cycle) : null,
        newCreditLimit: credit ? Number(limit) : 0,
      })
      setEditing(false)
      await reload()
    })

  const remove = () => {
    if (!confirm(`Delete account "${account.bankAccountName}"?`)) return
    run(async () => {
      await api.bankAccounts.remove(account.bankAccountId)
      await reload()
    })
  }

  if (editing) {
    return (
      <tr>
        <td><input value={name} onChange={(e) => setName(e.target.value)} /></td>
        <td>
          <select value={credit ? 'credit' : 'bank'} onChange={(e) => setCredit(e.target.value === 'credit')} aria-label="Account type">
            <option value="bank">Bank</option>
            <option value="credit">Credit card</option>
          </select>
        </td>
        <td className="num">{credit && <input type="number" min="1" max="31" placeholder="Day" value={cycle} onChange={(e) => setCycle(e.target.value)} aria-label="Billing day" />}</td>
        <td className="num">{credit && <input type="number" min="0.01" step="0.01" placeholder="Limit" value={limit} onChange={(e) => setLimit(e.target.value)} aria-label="Credit limit" />}</td>
        <td className="actions">
          <button className="small" disabled={busy} onClick={save}>Save</button>
          <button className="secondary small" onClick={() => setEditing(false)}>Cancel</button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="primary">{account.bankAccountName}</td>
      <td className="meta"><span className="tag">{isCredit ? 'Credit card' : 'Bank'}</span></td>
      <td data-label="Billing day">{account.creditCycle ?? '—'}</td>
      <td className="num">{isCredit ? fmt(account.creditLimit) : '—'}</td>
      <td className="actions">
        <button className="secondary small" onClick={startEdit}>Edit</button>
        <button className="danger small" disabled={busy} onClick={remove}>Delete</button>
      </td>
    </tr>
  )
}
