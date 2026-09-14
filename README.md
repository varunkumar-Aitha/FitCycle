# Gym Tracker — 3-Month Fitness Plan

A full-stack Single Page Application for tracking gym workouts, nutrition and water intake over a 12-week training programme.

## Features

- **JWT Authentication** — Register, login, persistent sessions
- **12-Week Workout Plan** — Structured 4-day rotation with week tracking
- **Muscle Group Rotation** — Prevents accidental repeat of same muscle focus
- **Gym Session Tracking** — Sets, reps, weight per exercise with auto-save
- **Progressive Overload** — Shows previous performance and suggests weight increases
- **Personal Records** — Tracks PRs per exercise
- **Workout History** — Full history with filters and expandable details
- **Food Tracker** — Log meals by type (Breakfast/Lunch/Dinner/Snacks)
- **Calorie & Protein Tracking** — Daily totals with progress bars
- **Water Tracker** — Quick-add buttons, daily goal tracking
- **Progress Dashboard** — Charts for workout completion and strength progress
- **Responsive Design** — Desktop and mobile support with dark gym theme

## Tech Stack

**Frontend:** React 18, React Router 6, Axios, Recharts, Vite  
**Backend:** Node.js, Express.js, JWT, bcryptjs  
**Database:** MongoDB with Mongoose

## Folder Structure

```
gym-tracker/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── context/         # AuthContext
│   │   ├── hooks/           # Custom hooks
│   │   ├── layouts/         # AppLayout with sidebar
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   └── utils/           # Formatters
│   └── package.json
│
├── server/                  # Express backend
│   ├── config/              # DB connection
│   ├── controllers/         # Business logic
│   ├── middleware/          # Auth, error handler, validation
│   ├── models/              # Mongoose models
│   ├── routes/              # Express routers
│   ├── utils/               # Seed script, date utils
│   └── package.json
│
├── .env.example
└── package.json
```

## Installation

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### 1. Clone and install dependencies

```bash
cd gym-tracker
npm run install:all
```

Or separately:

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Environment Variables

Copy `.env.example` to `server/.env` and fill in values:

```bash
cp .env.example server/.env
```

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/gym-tracker
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Seed Exercise Database

```bash
cd server
npm run seed
```

This loads 60+ exercises across all muscle groups.

### 4. Start the Application

**Backend (port 5000):**
```bash
cd server
npm run dev
```

**Frontend (port 5173):**
```bash
cd client
npm run dev
```

Or use the root package.json (requires `concurrently`):
```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## API Documentation

### Authentication

| Method | Route | Access |
|--------|-------|--------|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Private |
| PUT | /api/auth/me | Private |

### Workouts

| Method | Route | Access |
|--------|-------|--------|
| GET | /api/workouts/today | Private |
| GET | /api/workouts | Private |
| GET | /api/workouts/:id | Private |
| POST | /api/workouts | Private |
| PUT | /api/workouts/:id | Private |
| POST | /api/workouts/:id/complete | Private |
| DELETE | /api/workouts/:id | Private |
| GET | /api/workouts/recent-muscles | Private |
| GET | /api/workouts/prs | Private |

### Exercises

| Method | Route | Access |
|--------|-------|--------|
| GET | /api/exercises | Private |
| GET | /api/exercises/:id | Private |
| POST | /api/exercises | Private |
| DELETE | /api/exercises/:id | Private |

### Food

| Method | Route | Access |
|--------|-------|--------|
| GET | /api/food?date=YYYY-MM-DD | Private |
| GET | /api/food/weekly | Private |
| POST | /api/food | Private |
| PUT | /api/food/:id | Private |
| DELETE | /api/food/:id | Private |

### Water

| Method | Route | Access |
|--------|-------|--------|
| GET | /api/water?date=YYYY-MM-DD | Private |
| POST | /api/water | Private |
| DELETE | /api/water/:id | Private |

### Dashboard

| Method | Route | Access |
|--------|-------|--------|
| GET | /api/dashboard | Private |

## Authentication Flow

1. User registers/logs in → backend returns `{ token, user }`
2. Token stored in `localStorage`
3. Axios interceptor attaches `Authorization: Bearer <token>` to all requests
4. On 401 response → token cleared → redirect to `/login`
5. On app load → `GET /api/auth/me` validates and restores session

## Database Models

- **User** — name, email, password (hashed), calorieGoal, proteinGoal, waterGoal, planStartDate
- **WorkoutSession** — userId, workoutType, dayNumber, weekNumber, exercises (with sets), status
- **Exercise** — name, muscleGroup, targetArea, equipment, difficulty, instructions
- **FoodEntry** — userId, date, foodName, quantity, calories, protein, carbs, fat, mealType
- **WaterEntry** — userId, date, amountMl

## Workout Split

| Day | Workout | Muscle Groups |
|-----|---------|---------------|
| 1 | Chest + Triceps + Lower Back | Chest, Triceps, Lower Back |
| 2 | Back + Biceps | Back, Biceps, Forearms |
| 3 | Legs + Shoulders | Legs, Shoulders |
| 4 | Arms + Abs | Biceps, Triceps, Forearms, Abs |

The rotation continues from where you left off — no repeated muscle groups back-to-back.

## Production Build

```bash
cd client
npm run build
```

Then serve the `dist/` folder from Express or a static host.
