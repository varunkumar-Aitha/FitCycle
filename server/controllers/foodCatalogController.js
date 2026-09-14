const foodCatalog = require('../data/foodCatalog')

// @desc  Get all food catalog items (optionally filtered by search/category)
// @route GET /api/food-catalog
// @access Private
const getCatalog = (req, res) => {
  const { search, category } = req.query

  let results = foodCatalog

  if (category) {
    results = results.filter(f => f.category.toLowerCase() === category.toLowerCase())
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase()
    results = results.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
    )
  }

  res.json({ success: true, items: results, total: results.length })
}

module.exports = { getCatalog }
