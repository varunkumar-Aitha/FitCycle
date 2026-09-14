const express = require('express');
const router = express.Router();
const { getGameMap, getPlayerProfile } = require('../controllers/gamemapController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getGameMap);
router.get('/profile', getPlayerProfile);

module.exports = router;
