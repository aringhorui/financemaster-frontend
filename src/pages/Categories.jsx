import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { PageHeader } from '../components/Layout'
import { categoryColor, fmt } from '../format'
import { useAction } from '../useAsync'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const { busy, error, run } = useAction()

  const load = useCallback(
    () =>
      run(async () => {
        const [cats, subs] = await Promise.all([api.categories.list(), api.subcategories.list()])
        setCategories(cats)
        setSubcategories(subs)
      }),
    [run],
  )

  useEffect(() => {
    load()
  }, [load])

  const [newName, setNewName] = useState('')
  const [newBudget, setNewBudget] = useState('')

  const addCategory = (e) => {
    e.preventDefault()
    run(async () => {
      await api.categories.add(newName, newBudget === '' ? null : Number(newBudget))
      setNewName('')
      setNewBudget('')
      await load()
    })
  }

  return (
    <>
      <PageHeader title="Categories" subtitle="Set a budget for each category and split it across subcategories." />
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>New category</h3>
        <form className="row" onSubmit={addCategory}>
          <label>Category name<input required value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
          <label>Monthly budget<input type="number" min="0" step="0.01" value={newBudget} onChange={(e) => setNewBudget(e.target.value)} /></label>
          <button disabled={busy}>Add</button>
        </form>
      </div>

      {categories.length === 0 && !busy && <div className="card empty">No categories yet. Add one above to start budgeting.</div>}

      {categories.map((c) => (
        <CategoryCard
          key={c.categoryId}
          category={c}
          subcategories={subcategories.filter((s) => s.categoryId === c.categoryId)}
          run={run}
          busy={busy}
          reload={load}
        />
      ))}
    </>
  )
}

function CategoryCard({ category, subcategories, run, busy, reload }) {
  const [editing, setEditing] = useState(false)
  const [budget, setBudget] = useState(category.categoryBudget ?? 0)
  const [subName, setSubName] = useState('')
  const [subBudget, setSubBudget] = useState('')

  const allocated = subcategories.reduce((sum, s) => sum + (s.subcategoryBudget || 0), 0)
  const pct = category.categoryBudget > 0 ? Math.min(100, (allocated / category.categoryBudget) * 100) : 0

  const saveBudget = () =>
    run(async () => {
      await api.categories.edit(category.categoryId, Number(budget))
      setEditing(false)
      await reload()
    })

  const remove = () => {
    if (!confirm(`Delete category "${category.categoryName}" and its subcategories?`)) return
    run(async () => {
      await api.categories.remove(category.categoryId)
      await reload()
    })
  }

  const addSub = (e) => {
    e.preventDefault()
    run(async () => {
      await api.subcategories.add({
        categoryId: category.categoryId,
        subcategoryName: subName,
        subcategoryBudget: subBudget === '' ? 0 : Number(subBudget),
      })
      setSubName('')
      setSubBudget('')
      await reload()
    })
  }

  return (
    <div className="card flush">
      <div className="cat-head">
        <span className="dot" style={{ background: categoryColor(category.categoryName) }} />
        <h3>{category.categoryName}</h3>
        {editing ? (
          <>
            <input type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: 130 }} aria-label="Category budget" />
            <button className="small" disabled={busy} onClick={saveBudget}>Save</button>
            <button className="secondary small" onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <span className="cat-meta">
              Allocated <strong>{fmt(allocated)}</strong> of <strong>{fmt(category.categoryBudget)}</strong>
            </span>
            <button className="secondary small" onClick={() => setEditing(true)}>Edit budget</button>
            <button className="danger small" disabled={busy} onClick={remove}>Delete</button>
          </>
        )}
      </div>
      <div className={`meter${pct >= 100 ? ' full' : ''}`} role="img" aria-label={`${Math.round(pct)}% of budget allocated to subcategories`}>
        <span style={{ width: `${pct}%`, background: pct >= 100 ? undefined : categoryColor(category.categoryName) }} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Subcategory</th><th className="num">Budget</th><th /></tr>
          </thead>
          <tbody>
            {subcategories.map((s) => (
              <SubRow key={s.subcategoryId} sub={s} run={run} busy={busy} reload={reload} />
            ))}
            <tr>
              <td colSpan={3} className="add-row">
                <form className="row" onSubmit={addSub}>
                  <input required placeholder="New subcategory" value={subName} onChange={(e) => setSubName(e.target.value)} />
                  <input type="number" min="0" step="0.01" placeholder="Budget" value={subBudget} onChange={(e) => setSubBudget(e.target.value)} style={{ width: 120 }} />
                  <button className="small" disabled={busy}>Add subcategory</button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SubRow({ sub, run, busy, reload }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sub.subcategoryName)
  const [budget, setBudget] = useState(sub.subcategoryBudget ?? 0)

  const save = () =>
    run(async () => {
      await api.subcategories.edit({
        subcategoryId: sub.subcategoryId,
        subcategoryName: name,
        subcategoryBudget: Number(budget),
      })
      setEditing(false)
      await reload()
    })

  const remove = () => {
    if (!confirm(`Delete subcategory "${sub.subcategoryName}"?`)) return
    run(async () => {
      await api.subcategories.remove(sub.subcategoryId)
      await reload()
    })
  }

  if (editing) {
    return (
      <tr>
        <td><input value={name} onChange={(e) => setName(e.target.value)} /></td>
        <td className="num"><input type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} /></td>
        <td className="actions">
          <button className="small" disabled={busy} onClick={save}>Save</button>
          <button className="secondary small" onClick={() => setEditing(false)}>Cancel</button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{sub.subcategoryName}</td>
      <td className="num">{fmt(sub.subcategoryBudget)}</td>
      <td className="actions">
        <button className="secondary small" onClick={() => setEditing(true)}>Edit</button>
        <button className="danger small" disabled={busy} onClick={remove}>Delete</button>
      </td>
    </tr>
  )
}
