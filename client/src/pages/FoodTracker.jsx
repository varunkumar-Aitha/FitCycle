import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { foodService, foodCatalogService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import ProgressBar from '../components/ProgressBar'
import { toDateString } from '../utils/formatters'
import { useToast } from '../context/ToastContext'

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

const MEAL_ICONS = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
  Snacks: '⚡'
}

// Format effective quantity nicely: 200g, 4 eggs, 2 scoops, etc.
const formatQty = (servings, item) => {
  const { unit, quantity } = item
  if (unit === 'g' || unit === 'ml') {
    return `${servings * quantity}${unit}`
  }
  const total = servings * quantity
  return `${total} ${unit}${total !== 1 ? 's' : ''}`
}

const FoodTracker = () => {
  const { user } = useAuth()
  const toast = useToast()

  // ── date & logged entries ──────────────────────────────────────
  const [date, setDate] = useState(toDateString())
  const [entries, setEntries] = useState([])
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [loading, setLoading] = useState(true)

  // ── catalog ────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  // ── picker modal ───────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false)
  const [pickerMeal, setPickerMeal] = useState('Breakfast')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  // quantities: { itemId → servings (integer ≥ 1) }
  // presence in object = selected; absence = not selected
  const [quantities, setQuantities] = useState({})

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const goals = {
    calories: user?.calorieGoal || 2200,
    protein:  user?.proteinGoal || 120
  }

  // load catalog once
  useEffect(() => {
    const fetchCatalog = async () => {
      setCatalogLoading(true)
      try {
        const res = await foodCatalogService.getAll()
        setCatalog(res.data.items)
      } catch {
        toast.error('Could not load food catalog.')
      } finally {
        setCatalogLoading(false)
      }
    }
    fetchCatalog()
  }, [])

  useEffect(() => { loadFood() }, [date])

  const loadFood = async () => {
    setLoading(true)
    try {
      const res = await foodService.getByDate(date)
      setEntries(res.data.entries)
      setTotals(res.data.totals)
    } catch {
      toast.error('Unable to load food entries.')
    } finally {
      setLoading(false)
    }
  }

  const openPicker = (meal) => {
    setPickerMeal(meal)
    setQuantities({})
    setSearch('')
    setActiveCategory('All')
    setShowPicker(true)
  }

  // Toggle selection: adds with 1 serving, or removes completely
  const toggleItem = (id) => {
    setQuantities(prev => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: 1 }
    })
  }

  const increment = (id, e) => {
    e.stopPropagation()
    setQuantities(prev => ({ ...prev, [id]: (prev[id] || 1) + 1 }))
  }

  const decrement = (id, e) => {
    e.stopPropagation()
    setQuantities(prev => {
      const next = (prev[id] || 1) - 1
      if (next <= 0) {
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: next }
    })
  }

  // Filtered catalog list
  const categories = useMemo(() => {
    return ['All', ...new Set(catalog.map(f => f.category))]
  }, [catalog])

  const filtered = useMemo(() => {
    return catalog.filter(f => {
      const matchCat    = activeCategory === 'All' || f.category === activeCategory
      const matchSearch = !search.trim() ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.type.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [catalog, activeCategory, search])

  // Selected items with their effective macros (×servings)
  const selectedItems = useMemo(() => {
    return catalog
      .filter(f => quantities[f.id])
      .map(f => {
        const s = quantities[f.id]
        return { ...f, servings: s, totalCalories: f.calories * s, totalProtein: f.protein * s, totalCarbs: f.carbs * s, totalFat: f.fat * s }
      })
  }, [catalog, quantities])

  const selectionTotals = useMemo(() => {
    return selectedItems.reduce((acc, f) => ({
      calories: acc.calories + f.totalCalories,
      protein:  acc.protein  + f.totalProtein,
      carbs:    acc.carbs    + f.totalCarbs,
      fat:      acc.fat      + f.totalFat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }, [selectedItems])

  const handleSave = async () => {
    if (!selectedItems.length) {
      toast.warning('Select at least one food item.')
      return
    }
    setSaving(true)
    try {
      const payload = selectedItems.map(f => ({
        foodName: f.name,
        quantity: f.servings * f.quantity,
        unit:     f.unit,
        calories: Math.round(f.totalCalories),
        protein:  Math.round(f.totalProtein),
        carbs:    Math.round(f.totalCarbs),
        fat:      Math.round(f.totalFat),
        mealType: pickerMeal
      }))
      await foodService.createBulk({ entries: payload, date })
      toast.success(`${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} saved to ${pickerMeal}!`)
      setShowPicker(false)
      loadFood()
    } catch {
      toast.error('Failed to save food items.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await foodService.delete(id)
      toast.success('Food entry removed.')
      loadFood()
    } catch {
      toast.error('Failed to delete entry.')
    } finally {
      setDeleting(null)
    }
  }

  const groupedByMeal = MEAL_TYPES.reduce((acc, meal) => {
    acc[meal] = entries.filter(e => e.mealType === meal)
    return acc
  }, {})

  const selectedCount = selectedItems.length

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Food Tracker</h1>
          <p className="page-subtitle">Track your daily nutrition</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="date-selector">
        <button className="btn btn-icon" onClick={() => {
          const d = new Date(date); d.setDate(d.getDate() - 1); setDate(toDateString(d))
        }}>←</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="date-input" />
        <button className="btn btn-icon" onClick={() => {
          const d = new Date(date); d.setDate(d.getDate() + 1); setDate(toDateString(d))
        }}>→</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setDate(toDateString())}>Today</button>
      </div>

      {/* Macro Summary */}
      <div className="nutrition-summary">
        <div className="nutrition-card">
          <div className="nutrition-card-header"><span className="nutrition-icon">🔥</span><span>Calories</span></div>
          <div className="nutrition-values">
            <span className="nutrition-current">{Math.round(totals.calories)}</span>
            <span className="nutrition-target">/ {goals.calories}</span>
          </div>
          <ProgressBar value={totals.calories} max={goals.calories} color="calories" />
        </div>
        <div className="nutrition-card">
          <div className="nutrition-card-header"><span className="nutrition-icon">🍗</span><span>Protein</span></div>
          <div className="nutrition-values">
            <span className="nutrition-current">{Math.round(totals.protein)}g</span>
            <span className="nutrition-target">/ {goals.protein}g</span>
          </div>
          <ProgressBar value={totals.protein} max={goals.protein} color="protein" />
        </div>
        <div className="nutrition-card">
          <div className="nutrition-card-header"><span className="nutrition-icon">🌾</span><span>Carbs</span></div>
          <div className="nutrition-values"><span className="nutrition-current">{Math.round(totals.carbs)}g</span></div>
        </div>
        <div className="nutrition-card">
          <div className="nutrition-card-header"><span className="nutrition-icon">🥑</span><span>Fat</span></div>
          <div className="nutrition-values"><span className="nutrition-current">{Math.round(totals.fat)}g</span></div>
        </div>
      </div>

      {/* Meal Sections */}
      {loading ? (
        <LoadingSpinner text="Loading food entries..." />
      ) : (
        <div className="meals-list">
          {MEAL_TYPES.map(meal => {
            const mealEntries = groupedByMeal[meal]
            const mealCals = mealEntries.reduce((s, e) => s + e.calories, 0)
            return (
              <div key={meal} className="meal-section">
                <div className="meal-header">
                  <div className="meal-header-left">
                    <span className="meal-icon">{MEAL_ICONS[meal]}</span>
                    <h3>{meal}</h3>
                    {mealCals > 0 && <span className="meal-calories">{Math.round(mealCals)} kcal</span>}
                  </div>
                  <button className="btn-add-meal-catalog" onClick={() => openPicker(meal)}>
                    + Add
                  </button>
                </div>

                {mealEntries.length === 0 ? (
                  <p className="meal-empty">No {meal.toLowerCase()} logged yet</p>
                ) : (
                  <div className="food-entries">
                    {mealEntries.map(entry => (
                      <div key={entry._id} className="food-entry">
                        <div className="food-entry-info">
                          <span className="food-name">{entry.foodName}</span>
                          <span className="food-serving">{entry.quantity}{entry.unit}</span>
                        </div>
                        <div className="food-entry-macros">
                          <span className="macro-chip calories">{Math.round(entry.calories)} kcal</span>
                          <span className="macro-chip protein">P {Math.round(entry.protein)}g</span>
                          <span className="macro-chip carbs">C {Math.round(entry.carbs)}g</span>
                          <span className="macro-chip fat">F {Math.round(entry.fat)}g</span>
                        </div>
                        <button
                          className="btn-delete-food"
                          onClick={() => handleDelete(entry._id)}
                          disabled={deleting === entry._id}
                          title="Remove"
                        >
                          {deleting === entry._id ? '…' : '✕'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── FOOD PICKER MODAL ─────────────────────────────────── */}
      {showPicker && (
        <div className="modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="food-picker-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="food-picker-header">
              <div>
                <h3>Add to {pickerMeal}</h3>
                <p className="food-picker-sub">Tap to select · use +/− to adjust quantity</p>
              </div>
              <button className="modal-close" onClick={() => setShowPicker(false)}>✕</button>
            </div>

            {/* Search */}
            <div className="food-picker-search-wrap">
              <span className="food-search-icon">🔍</span>
              <input
                className="food-picker-search"
                type="text"
                placeholder="Search food..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button className="food-search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>

            {/* Category tabs */}
            <div className="food-category-tabs">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`food-cat-tab ${activeCategory === cat ? 'food-cat-tab-active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Food list */}
            <div className="food-catalog-list">
              {catalogLoading ? (
                <LoadingSpinner text="Loading catalog..." />
              ) : filtered.length === 0 ? (
                <div className="food-catalog-empty">No items found for "{search}"</div>
              ) : (
                filtered.map(item => {
                  const servings   = quantities[item.id] || 0
                  const isSelected = servings > 0
                  const dispCal    = Math.round(item.calories * (isSelected ? servings : 1))
                  const dispPro    = Math.round(item.protein  * (isSelected ? servings : 1))
                  const dispCarb   = Math.round(item.carbs    * (isSelected ? servings : 1))
                  const dispFat    = Math.round(item.fat      * (isSelected ? servings : 1))

                  return (
                    <div
                      key={item.id}
                      className={`food-catalog-item ${isSelected ? 'food-catalog-item-selected' : ''}`}
                      onClick={() => toggleItem(item.id)}
                    >
                      {/* Checkbox */}
                      <div className="food-catalog-check" onClick={e => { e.stopPropagation(); toggleItem(item.id) }}>
                        <div className={`food-check-box ${isSelected ? 'food-check-box-checked' : ''}`}>
                          {isSelected && <span>✓</span>}
                        </div>
                      </div>

                      {/* Emoji */}
                      <span className="food-catalog-emoji">{item.emoji}</span>

                      {/* Name + serving / quantity stepper */}
                      <div className="food-catalog-info">
                        <div className="food-catalog-name">{item.name}</div>
                        {isSelected ? (
                          <div className="food-qty-stepper" onClick={e => e.stopPropagation()}>
                            <button
                              className="fqs-btn fqs-dec"
                              onClick={e => decrement(item.id, e)}
                              aria-label="Decrease"
                            >−</button>
                            <span className="fqs-label">{formatQty(servings, item)}</span>
                            <button
                              className="fqs-btn fqs-inc"
                              onClick={e => increment(item.id, e)}
                              aria-label="Increase"
                            >+</button>
                          </div>
                        ) : (
                          <div className="food-catalog-serving">{item.serving}</div>
                        )}
                      </div>

                      {/* Macros (update live when selected) */}
                      <div className="food-catalog-macros">
                        <span className={`fci-cal ${isSelected ? 'fci-active' : ''}`}>{dispCal} kcal</span>
                        <span className="fci-protein">P {dispPro}g</span>
                        <span className="fci-carb">C {dispCarb}g</span>
                        <span className="fci-fat">F {dispFat}g</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Selection summary + save */}
            <div className="food-picker-footer">
              {selectedCount > 0 ? (
                <div className="food-picker-summary">
                  <div className="fps-count">{selectedCount} item{selectedCount > 1 ? 's' : ''} selected</div>
                  <div className="fps-macros">
                    <span>{Math.round(selectionTotals.calories)} kcal</span>
                    <span>·</span>
                    <span>P {Math.round(selectionTotals.protein)}g</span>
                    <span>·</span>
                    <span>C {Math.round(selectionTotals.carbs)}g</span>
                    <span>·</span>
                    <span>F {Math.round(selectionTotals.fat)}g</span>
                  </div>
                </div>
              ) : (
                <div className="fps-hint">Tap items above to select them</div>
              )}
              <button
                className="btn btn-primary fps-save-btn"
                onClick={handleSave}
                disabled={saving || selectedCount === 0}
              >
                {saving ? 'Saving...' : `Save to ${pickerMeal}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FoodTracker
