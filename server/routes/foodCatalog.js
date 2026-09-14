const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { getCatalog } = require('../controllers/foodCatalogController')

router.use(protect)

router.get('/', getCatalog)

module.exports = router
