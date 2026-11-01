import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { PageHeader } from '../components/Layout'
import { fmt } from '../format'
import { useAction } from '../useAsync'

const MAX_ROWS = 5000
const STEPS = ['Choose files', 'Review', 'Done']
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function Import() {
  const { busy, error, setError, run } = useAction()
  const [files, setFiles] = useState([]) // { name, count, cycle, error }
  const [rows, setRows] = useState([]) // merged expenses
  const [origin, setOrigin] = useState([]) // per merged row: { file, row }
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const step = result ? 2 : preview ? 1 : 0

  const readFiles = async (list) => {
    setError('')
    const parsed = await Promise.all(
      [...list].map(async (f) => {
        try {
          const json = JSON.parse(await f.text())
          const expenses = Array.isArray(json) ? json : json.expenses
          if (!Array.isArray(expenses)) return { name: f.name, error: 'No "expenses" list found in this file' }
          return { name: f.name, count: expenses.length, cycle: json.salary_cycle, expenses }
        } catch {
          return { name: f.name, error: 'Not a valid JSON file' }
        }
      }),
    )
    const merged = []
    const from = []
    parsed.forEach((p) => p.expenses?.forEach((e, i) => { merged.push(e); from.push({ file: p.name, row: i + 1 }) }))
    setFiles(parsed.map((p) => ({ name: p.name, count: p.count, cycle: p.cycle, error: p.error })))
    setRows(merged)
    setOrigin(from)
    setPreview(null)
  }

  const runPreview = () =>
    run(async () => setPreview(await api.import.run({ expenses: rows }, true)))

  const runImport = () =>
    run(async () => setResult(await api.import.run({ expenses: rows }, false)))

  const reset = () => {
    setFiles([])
    setRows([])
    setOrigin([])
    setPreview(null)
    setResult(null)
    setError('')
  }

  const tooMany = rows.length > MAX_ROWS

  return (
    <>
      <PageHeader title="Import expenses" subtitle="Bring in expenses exported from another tracker as JSON.">
        <Link to="/expenses"><button className="secondary">Back to expenses</button></Link>
      </PageHeader>

      <ol className="steps" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {error && <div className="error">{error}</div>}

      {step === 0 && (
        <section className="card">
          <label className="drop">
            <input type="file" accept=".json,application/json" multiple onChange={(e) => readFiles(e.target.files)} />
            <strong>Choose JSON files</strong>
            <span className="muted">One or more archives, each with an <code>expenses</code> list. Nothing is saved until you confirm.</span>
          </label>

          {files.length > 0 && (
            <>
              <table className="file-table">
                <tbody>
                  {files.map((f) => (
                    <tr key={f.name}>
                      <td>{f.name}</td>
                      <td>{f.cycle ? `Salary cycle ${day(f.cycle.start)} to ${day(f.cycle.end)}` : ''}</td>
                      <td className="num">{f.error ? <span className="neg">{f.error}</span> : `${f.count} expenses`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tooMany && <div className="error">That's {rows.length} expenses. Import at most {MAX_ROWS} at a time.</div>}
              <div className="actions-row">
                <button disabled={busy || !rows.length || tooMany} onClick={runPreview}>
                  {busy ? 'Checking…' : `Check ${rows.length} expenses`}
                </button>
              </div>
            </>
          )}

          <details className="format">
            <summary>Expected format</summary>
            <pre>{`{
  "expenses": [
    {
      "id": "3f61abe9-…",          // optional, used to skip repeats
      "expense": "Noodles",          // saved as the note
      "amount": 280,
      "date": "2026-10-10T22:58:00.000+05:30",
      "category": "Want",
      "sub_category": "Food and Dining",
      "payment_method": "UPI",
      "bank_account": "Icici Savings", // optional
      "notes": ""                      // optional
    }
  ]
}`}</pre>
          </details>
        </section>
      )}

      {step === 1 && <Review preview={preview} origin={origin} busy={busy} onImport={runImport} onBack={reset} />}

      {step === 2 && (
        <section className="card done">
          <h3>Imported {result.imported} {result.imported === 1 ? 'expense' : 'expenses'}</h3>
          <p>
            {fmt(result.importedAmount)} from {day(result.firstDate)} to {day(result.lastDate)}.
            {result.duplicates > 0 && ` ${result.duplicates} already imported and skipped.`}
            {result.errors.length > 0 && ` ${result.errors.length} could not be imported.`}
          </p>
          <Created r={result} past />
          <div className="actions-row">
            <Link to="/expenses"><button>View expenses</button></Link>
            <Link to="/overview"><button className="secondary">Open overview</button></Link>
            <button className="secondary" onClick={reset}>Import more</button>
          </div>
        </section>
      )}
    </>
  )
}

function Review({ preview, origin, busy, onImport, onBack }) {
  const p = preview
  return (
    <>
      <section className="trend-facts">
        <div><dt>Ready to import</dt><dd className="fig">{p.imported}</dd><dd className="sub">of {p.totalRows} rows</dd></div>
        <div><dt>Total amount</dt><dd className="fig">{fmt(p.importedAmount)}</dd>{p.firstDate && <dd className="sub">{day(p.firstDate)} to {day(p.lastDate)}</dd>}</div>
        <div><dt>Already imported</dt><dd className="fig">{p.duplicates}</dd><dd className="sub">skipped by id</dd></div>
        <div><dt>Can't import</dt><dd className={`fig ${p.errors.length ? 'neg' : ''}`}>{p.errors.length}</dd><dd className="sub">listed below</dd></div>
      </section>

      <div className="ov-grid">
        <section className="panel">
          <div className="panel-head"><h3>Will be created</h3></div>
          <Created r={p} />
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Matched to existing</h3><span className="muted">Names in the file that differ in spelling</span></div>
          {p.mappings.length ? (
            <ul className="plain-list">
              {p.mappings.map((m) => (
                <li key={`${m.type}-${m.from}`}><span className="muted">{m.type}</span> “{m.from}” uses <strong>{m.to}</strong></li>
              ))}
            </ul>
          ) : <p className="muted">Every name matched exactly.</p>}
        </section>

        {p.errors.length > 0 && (
          <section className="panel span-2">
            <div className="panel-head"><h3>Rows that can't be imported</h3><span className="muted">Fix these in the file and import again; the rest are not affected</span></div>
            <div className="table-wrap">
              <table className="trend-table">
                <thead><tr><th>File and row</th><th>Expense</th><th>Problem</th></tr></thead>
                <tbody>
                  {p.errors.map((e) => {
                    const o = origin[e.row - 1]
                    return (
                      <tr key={e.row}>
                        <td>{o ? `${o.file}, row ${o.row}` : `Row ${e.row}`}</td>
                        <td>{e.description || e.id || '—'}</td>
                        <td className="neg">{e.reason}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <div className="actions-row sticky-actions">
        <button className="secondary" onClick={onBack} disabled={busy}>Choose other files</button>
        <button onClick={onImport} disabled={busy || !p.imported}>
          {busy ? 'Importing…' : `Import ${p.imported} ${p.imported === 1 ? 'expense' : 'expenses'}`}
        </button>
      </div>
    </>
  )
}

function Created({ r, past }) {
  const groups = [
    ['Categories', r.createdCategories],
    ['Subcategories', r.createdSubcategories],
    ['Payment methods', r.createdPaymentMethods],
    ['Bank accounts', r.createdBankAccounts],
  ].filter(([, list]) => list.length)

  if (!groups.length && !r.reactivated.length) {
    return <p className="muted">Nothing new{past ? ' was' : ' needs to be'} created. Everything in the file already exists.</p>
  }
  return (
    <div className="created">
      {groups.map(([label, list]) => (
        <div key={label}>
          <span className="muted">{label}</span>
          <div className="tags">{list.map((n) => <span key={n} className="tag">{n}</span>)}</div>
        </div>
      ))}
      {r.reactivated.length > 0 && (
        <div>
          <span className="muted">{past ? 'Restored' : 'Will be restored'} (previously deleted)</span>
          <div className="tags">{r.reactivated.map((n) => <span key={n} className="tag">{n}</span>)}</div>
        </div>
      )}
      {r.createdBankAccounts.length > 0 && (
        <p className="hint">New bank accounts are added as regular accounts. If one is a credit card, edit it under Bank accounts and set its billing day and limit.</p>
      )}
      {r.createdCategories.length > 0 && <p className="hint">New categories start with no budget. Set one under Categories.</p>}
    </div>
  )
}
