// Food catalog derived from Food.txt
// All macros are per standard serving defined in the `serving` field
// calories, protein, carbs, fat are numbers per serving

const foodCatalog = [
  // ─── Breakfast ────────────────────────────────────────────────
  { id: 'egg',               name: 'Eggs',                 category: 'Breakfast', type: 'Protein',        emoji: '🥚', serving: '1 egg (50g)',    unit: 'egg',    quantity: 1,   calories: 78,  protein: 6,   carbs: 1,   fat: 5   },
  { id: 'egg_whites',        name: 'Egg Whites',           category: 'Breakfast', type: 'Protein',        emoji: '🥚', serving: '100g',           unit: 'g',      quantity: 100, calories: 52,  protein: 11,  carbs: 1,   fat: 0   },
  { id: 'oats',              name: 'Oats',                 category: 'Breakfast', type: 'Carb',           emoji: '🌾', serving: '100g',           unit: 'g',      quantity: 100, calories: 389, protein: 13,  carbs: 66,  fat: 7   },
  { id: 'greek_yogurt',      name: 'Greek Yogurt',         category: 'Breakfast', type: 'Protein',        emoji: '🥛', serving: '100g',           unit: 'g',      quantity: 100, calories: 97,  protein: 10,  carbs: 4,   fat: 5   },
  { id: 'paneer',            name: 'Paneer',               category: 'Breakfast', type: 'Protein/Fat',    emoji: '🧀', serving: '100g',           unit: 'g',      quantity: 100, calories: 265, protein: 18,  carbs: 3,   fat: 20  },
  { id: 'low_fat_paneer',    name: 'Low-fat Paneer',       category: 'Breakfast', type: 'Protein',        emoji: '🧀', serving: '100g',           unit: 'g',      quantity: 100, calories: 190, protein: 20,  carbs: 4,   fat: 9   },
  { id: 'milk',              name: 'Milk',                 category: 'Breakfast', type: 'Protein',        emoji: '🥛', serving: '200ml',          unit: 'ml',     quantity: 200, calories: 122, protein: 6,   carbs: 9,   fat: 5   },
  { id: 'curd',              name: 'Curd',                 category: 'Breakfast', type: 'Protein',        emoji: '🥛', serving: '100g',           unit: 'g',      quantity: 100, calories: 61,  protein: 3,   carbs: 5,   fat: 3   },
  { id: 'wheat_bread',       name: 'Whole Wheat Bread',    category: 'Breakfast', type: 'Carb',           emoji: '🍞', serving: '2 slices (60g)', unit: 'g',      quantity: 60,  calories: 140, protein: 6,   carbs: 24,  fat: 2   },
  { id: 'peanut_butter',     name: 'Peanut Butter',        category: 'Breakfast', type: 'Protein/Fat',    emoji: '🥜', serving: '2 tbsp (32g)',   unit: 'g',      quantity: 32,  calories: 191, protein: 8,   carbs: 7,   fat: 16  },
  { id: 'poha',              name: 'Poha',                 category: 'Breakfast', type: 'Carb',           emoji: '🍛', serving: '1 bowl (150g)',  unit: 'g',      quantity: 150, calories: 180, protein: 3,   carbs: 38,  fat: 2   },
  { id: 'upma',              name: 'Upma',                 category: 'Breakfast', type: 'Carb',           emoji: '🍲', serving: '1 bowl (150g)',  unit: 'g',      quantity: 150, calories: 190, protein: 4,   carbs: 36,  fat: 4   },
  { id: 'idli',              name: 'Idli',                 category: 'Breakfast', type: 'Carb',           emoji: '🫓', serving: '2 pieces (80g)', unit: 'piece',  quantity: 2,   calories: 76,  protein: 4,   carbs: 15,  fat: 0   },
  { id: 'dosa',              name: 'Dosa',                 category: 'Breakfast', type: 'Carb',           emoji: '🥞', serving: '1 dosa (80g)',   unit: 'dosa',   quantity: 1,   calories: 133, protein: 3,   carbs: 25,  fat: 2   },

  // ─── Lunch ───────────────────────────────────────────────────
  { id: 'chicken_breast',    name: 'Chicken Breast',       category: 'Lunch',     type: 'High Protein',   emoji: '🍗', serving: '100g',           unit: 'g',      quantity: 100, calories: 165, protein: 31,  carbs: 0,   fat: 4   },
  { id: 'chicken_thigh',     name: 'Chicken Thigh',        category: 'Lunch',     type: 'Protein/Fat',    emoji: '🍗', serving: '100g',           unit: 'g',      quantity: 100, calories: 209, protein: 26,  carbs: 0,   fat: 11  },
  { id: 'grilled_chicken',   name: 'Grilled Chicken',      category: 'Lunch',     type: 'High Protein',   emoji: '🍗', serving: '100g',           unit: 'g',      quantity: 100, calories: 165, protein: 30,  carbs: 0,   fat: 4   },
  { id: 'fish',              name: 'Fish',                 category: 'Lunch',     type: 'High Protein',   emoji: '🐟', serving: '100g',           unit: 'g',      quantity: 100, calories: 136, protein: 22,  carbs: 0,   fat: 5   },
  { id: 'salmon',            name: 'Salmon',               category: 'Lunch',     type: 'Protein/Fat',    emoji: '🐟', serving: '100g',           unit: 'g',      quantity: 100, calories: 208, protein: 20,  carbs: 0,   fat: 13  },
  { id: 'tuna',              name: 'Tuna',                 category: 'Lunch',     type: 'High Protein',   emoji: '🐟', serving: '100g',           unit: 'g',      quantity: 100, calories: 144, protein: 25,  carbs: 0,   fat: 4   },
  { id: 'prawns',            name: 'Prawns',               category: 'Lunch',     type: 'High Protein',   emoji: '🦐', serving: '100g',           unit: 'g',      quantity: 100, calories: 99,  protein: 22,  carbs: 0,   fat: 1   },
  { id: 'lean_mutton',       name: 'Lean Mutton',          category: 'Lunch',     type: 'Protein',        emoji: '🥩', serving: '100g',           unit: 'g',      quantity: 100, calories: 218, protein: 25,  carbs: 0,   fat: 13  },
  { id: 'dal',               name: 'Dal',                  category: 'Lunch',     type: 'Protein/Carb',   emoji: '🍲', serving: '1 bowl (150g)',  unit: 'g',      quantity: 150, calories: 180, protein: 12,  carbs: 28,  fat: 1   },
  { id: 'rajma',             name: 'Rajma',                category: 'Lunch',     type: 'Protein/Carb',   emoji: '🫘', serving: '1 bowl (150g)',  unit: 'g',      quantity: 150, calories: 210, protein: 13,  carbs: 36,  fat: 1   },
  { id: 'chana',             name: 'Chana',                category: 'Lunch',     type: 'Protein/Carb',   emoji: '🫘', serving: '1 bowl (150g)',  unit: 'g',      quantity: 150, calories: 195, protein: 13,  carbs: 33,  fat: 2   },
  { id: 'chickpeas',         name: 'Chickpeas',            category: 'Lunch',     type: 'Protein/Carb',   emoji: '🫘', serving: '100g cooked',    unit: 'g',      quantity: 100, calories: 164, protein: 9,   carbs: 27,  fat: 3   },
  { id: 'brown_rice',        name: 'Brown Rice',           category: 'Lunch',     type: 'Carb',           emoji: '🍚', serving: '1 cup cooked (150g)', unit: 'g', quantity: 150, calories: 215, protein: 4,   carbs: 45,  fat: 2   },
  { id: 'white_rice',        name: 'White Rice',           category: 'Lunch',     type: 'Carb',           emoji: '🍚', serving: '1 cup cooked (150g)', unit: 'g', quantity: 150, calories: 195, protein: 4,   carbs: 43,  fat: 0   },
  { id: 'quinoa',            name: 'Quinoa',               category: 'Lunch',     type: 'Protein/Carb',   emoji: '🌾', serving: '100g cooked',    unit: 'g',      quantity: 100, calories: 120, protein: 4,   carbs: 22,  fat: 2   },
  { id: 'roti',              name: 'Roti / Chapati',       category: 'Lunch',     type: 'Carb',           emoji: '🫓', serving: '2 rotis (60g)',   unit: 'roti',   quantity: 2,   calories: 160, protein: 6,   carbs: 30,  fat: 3   },

  // ─── Snacks / Pre-workout ─────────────────────────────────────
  { id: 'banana',            name: 'Banana',               category: 'Snacks',    type: 'Quick Carb',     emoji: '🍌', serving: '1 medium (120g)', unit: 'banana', quantity: 1,  calories: 105, protein: 1,   carbs: 27,  fat: 0   },
  { id: 'apple',             name: 'Apple',                category: 'Snacks',    type: 'Fruit/Carb',     emoji: '🍎', serving: '1 medium (180g)', unit: 'apple',  quantity: 1,  calories: 95,  protein: 0,   carbs: 25,  fat: 0   },
  { id: 'orange',            name: 'Orange',               category: 'Snacks',    type: 'Fruit',          emoji: '🍊', serving: '1 medium (150g)', unit: 'orange', quantity: 1,  calories: 62,  protein: 1,   carbs: 15,  fat: 0   },
  { id: 'dates',             name: 'Dates',                category: 'Snacks',    type: 'Quick Carb',     emoji: '🌴', serving: '4 pieces (28g)', unit: 'piece',  quantity: 4,   calories: 80,  protein: 1,   carbs: 21,  fat: 0   },
  { id: 'almonds',           name: 'Almonds',              category: 'Snacks',    type: 'Healthy Fat',    emoji: '🥜', serving: 'handful (28g)',  unit: 'g',      quantity: 28,  calories: 164, protein: 6,   carbs: 6,   fat: 14  },
  { id: 'walnuts',           name: 'Walnuts',              category: 'Snacks',    type: 'Healthy Fat',    emoji: '🌰', serving: 'handful (28g)',  unit: 'g',      quantity: 28,  calories: 185, protein: 4,   carbs: 4,   fat: 18  },
  { id: 'cashews',           name: 'Cashews',              category: 'Snacks',    type: 'Healthy Fat',    emoji: '🥜', serving: 'handful (28g)',  unit: 'g',      quantity: 28,  calories: 157, protein: 5,   carbs: 9,   fat: 12  },
  { id: 'pumpkin_seeds',     name: 'Pumpkin Seeds',        category: 'Snacks',    type: 'Protein/Fat',    emoji: '🌱', serving: '2 tbsp (20g)',   unit: 'g',      quantity: 20,  calories: 113, protein: 5,   carbs: 4,   fat: 9   },
  { id: 'chia_seeds',        name: 'Chia Seeds',           category: 'Snacks',    type: 'Fiber/Fat',      emoji: '🌱', serving: '1 tbsp (12g)',   unit: 'g',      quantity: 12,  calories: 58,  protein: 2,   carbs: 5,   fat: 4   },
  { id: 'roasted_chana',     name: 'Roasted Chana',        category: 'Snacks',    type: 'Protein/Carb',   emoji: '🫘', serving: '50g',            unit: 'g',      quantity: 50,  calories: 180, protein: 10,  carbs: 28,  fat: 3   },
  { id: 'peanut',            name: 'Peanuts',              category: 'Snacks',    type: 'Protein/Fat',    emoji: '🥜', serving: 'handful (28g)',  unit: 'g',      quantity: 28,  calories: 161, protein: 7,   carbs: 5,   fat: 14  },
  { id: 'cottage_cheese',    name: 'Cottage Cheese',       category: 'Snacks',    type: 'Protein',        emoji: '🧀', serving: '100g',           unit: 'g',      quantity: 100, calories: 98,  protein: 11,  carbs: 4,   fat: 4   },

  // ─── Post-workout ─────────────────────────────────────────────
  { id: 'whey_protein',      name: 'Whey Protein',         category: 'Dinner',    type: 'High Protein',   emoji: '💪', serving: '1 scoop (30g)',  unit: 'scoop',  quantity: 1,   calories: 120, protein: 25,  carbs: 3,   fat: 2   },
  { id: 'chicken_rice',      name: 'Chicken + Rice',       category: 'Dinner',    type: 'Protein/Carb',   emoji: '🍗', serving: '1 bowl',         unit: 'bowl',   quantity: 1,   calories: 350, protein: 32,  carbs: 45,  fat: 5   },
  { id: 'paneer_roti',       name: 'Paneer + Roti',        category: 'Dinner',    type: 'Protein/Carb',   emoji: '🧀', serving: '1 bowl + 2 rotis', unit: 'serving', quantity: 1, calories: 380, protein: 22, carbs: 40,  fat: 13  },
  { id: 'curd_oats',         name: 'Curd + Oats',          category: 'Dinner',    type: 'Protein/Carb',   emoji: '🥛', serving: '1 bowl',         unit: 'bowl',   quantity: 1,   calories: 210, protein: 12,  carbs: 32,  fat: 5   },

  // ─── Vegetables ───────────────────────────────────────────────
  { id: 'broccoli',          name: 'Broccoli',             category: 'Lunch',     type: 'Vegetable',      emoji: '🥦', serving: '100g',           unit: 'g',      quantity: 100, calories: 34,  protein: 3,   carbs: 6,   fat: 0   },
  { id: 'spinach',           name: 'Spinach',              category: 'Lunch',     type: 'Vegetable',      emoji: '🥬', serving: '100g',           unit: 'g',      quantity: 100, calories: 23,  protein: 3,   carbs: 4,   fat: 0   },
  { id: 'sweet_potato',      name: 'Sweet Potato',         category: 'Lunch',     type: 'Carb',           emoji: '🍠', serving: '1 medium (150g)', unit: 'g',     quantity: 150, calories: 130, protein: 3,   carbs: 30,  fat: 0   },
  { id: 'mixed_veg',         name: 'Mixed Vegetables',     category: 'Lunch',     type: 'Vegetable',      emoji: '🥗', serving: '1 bowl (150g)',  unit: 'g',      quantity: 150, calories: 65,  protein: 3,   carbs: 13,  fat: 1   },
]

module.exports = foodCatalog
