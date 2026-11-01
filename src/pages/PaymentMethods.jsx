import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../components/Layout'
import { useAction } from '../useAsync'

export default function PaymentMethods() {
  const [methods, setMethods] = useState([])
  const [names, setNames] = useState('')
  const { busy, error, run } = useAction()

  const load = useCallback(
    () => run(async () => setMethods((await api.paymentMethods.list()).paymentMethods || [])),
    [run],
  )

  useEffect(() => {
    load()
  }, [load])

  const add = (e) => {
    e.preventDefault()
    const list = names.split(',').map((n) => n.trim()).filter(Boolean)
    if (!list.length) return
    run(async () => {
      await api.paymentMethods.add(list)
      setNames('')
      await load()
    })
  }

  return (
    <>
      <PageHeader title="Payment methods" subtitle="The ways you pay. Pick one on every expense." />
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>New payment methods</h3>
        <form className="row" onSubmit={add}>
          <label style={{ flex: 1 }}>
            Names (comma separated)
            <input required placeholder="UPI, Cash, Debit card" value={names} onChange={(e) => setNames(e.target.value)} />
          </label>
          <button disabled={busy}>Add</button>
        </form>
      </div>

      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>Name</th><th /></tr></thead>
          <tbody>
            {methods.map((m) => (
              <Row key={m.paymentMethodId} method={m} run={run} busy={busy} reload={load} />
            ))}
            {methods.length === 0 && (
              <tr><td colSpan={2} className="empty">No payment methods yet. Add the ones you use, like UPI or Cash.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Row({ method, run, busy, reload }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(method.paymentMethodName)

  const save = () =>
    run(async () => {
      await api.paymentMethods.edit(method.paymentMethodId, name)
      setEditing(false)
      await reload()
    })

  const remove = () => {
    if (!confirm(`Delete payment method "${method.paymentMethodName}"?`)) return
    run(async () => {
      await api.paymentMethods.remove(method.paymentMethodId)
      await reload()
    })
  }

  return (
    <tr>
      <td>{editing ? <input value={name} onChange={(e) => setName(e.target.value)} /> : method.paymentMethodName}</td>
      <td className="actions">
        {editing ? (
          <>
            <button className="small" disabled={busy} onClick={save}>Save</button>
            <button className="secondary small" onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button className="secondary small" onClick={() => setEditing(true)}>Edit</button>
            <button className="danger small" disabled={busy} onClick={remove}>Delete</button>
          </>
        )}
      </td>
    </tr>
  )
}
