# EventConnect Platform

> A full-stack event management and ticketing platform built with Node.js, Express, MySQL, and vanilla HTML/CSS/JS — featuring Razorpay payment integration, interactive maps, and real-time organizer analytics.

---

## Overview

EventConnect is a web-based event management platform that supports two roles — **Users** and **Organizers**. Users can discover events on an interactive map, register, and pay securely. Organizers can create and manage events, track registrations, and monitor revenue through a dashboard with live charts.

---

## Features

### For Users
- Register and log in with JWT-based authentication
- Browse upcoming events on an interactive **Leaflet.js + OpenStreetMap** map (no API key required)
- View event details with a **mini route map** from current location to venue
- Register for free or paid events
- Secure payment via **Razorpay** with HMAC signature verification
- View registered events on a personal dashboard

### For Organizers
- Create, manage, and soft-delete events with category and capacity fields
- View **3 interactive Chart.js v4 dashboards**: Revenue per Event, Registrations per Event, and an Event Performance Donut
- Revenue and registration counts reflect only confirmed (`PAID`) transactions
- Optimistic UI with instant card removal and rollback on error

### Platform
- Secure payment flow: `PENDING → PAID` only after backend HMAC verification
- Cascade-delete: removing an event clears all linked registrations and payments
- Email notifications via Nodemailer (SMTP)
- Fully responsive frontend with no framework dependencies

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Backend    | Node.js, Express 5, mysql2                      |
| Auth       | JWT (`jsonwebtoken`), bcrypt                    |
| Payments   | Razorpay SDK, HMAC-SHA256 signature verification|
| Email      | Nodemailer (SMTP / Gmail)                       |
| Database   | MySQL 8                                         |
| Frontend   | Vanilla HTML, CSS, JavaScript                   |
| Maps       | Leaflet.js + OpenStreetMap + Leaflet Routing Machine (OSRM) |
| Charts     | Chart.js v4                                     |

---

## Project Structure

```
EventConnect Platform/
├── backend/
│   ├── controllers/
│   │   ├── authController.js         # Login & registration logic
│   │   ├── emailController.js        # Email notification helpers
│   │   ├── eventController.js        # Event CRUD + organizer stats
│   │   ├── paymentController.js      # Razorpay order creation & HMAC verification
│   │   ├── registerController.js     # Event registration (PENDING → PAID flow)
│   │   └── userEventController.js    # Fetch PAID registrations for a user
│   ├── routes/
│   │   ├── auth.js
│   │   ├── events.js
│   │   ├── payment.js                # Includes /failed endpoint
│   │   ├── register.js               # Includes /status endpoint
│   │   └── userEvents.js
│   ├── db.js                         # MySQL connection pool
│   ├── server.js                     # Express app entry point
│   └── package.json
├── database/
│   └── event_system.sql              # Full schema + migration comments
└── frontend/
    ├── index.html                    # Event discovery + map
    ├── login.html
    ├── register.html
    ├── user-dashboard.html           # User's registered events
    ├── organizer-dashboard.html      # Charts, stats, event management
    ├── create-event.html
    ├── payment.html                  # Razorpay checkout page
    ├── script.js                     # All frontend logic
    └── styles.css
```

---

## Database Schema

Four tables with foreign-key constraints and cascade deletes:

```sql
users          → user_id, name, email, password, role, created_at
events         → event_id, title, description, event_date, location,
                 price, category, capacity, organizer_id, is_deleted, created_at
registrations  → reg_id, user_id, event_id, payment_status (PENDING|PAID|FAILED), reg_date
payments       → payment_id, user_id, event_id, amount, status (PENDING|SUCCESS|FAILED),
                 razorpay_order_id, razorpay_payment_id, payment_date
```

`registrations.event_id` and `payments.event_id` both carry `ON DELETE CASCADE`, so deleting an event automatically removes all related rows.

---

## Getting Started

### Prerequisites

- **Node.js** v18+ and **npm**
- **MySQL** 8.0+
- A [Razorpay](https://razorpay.com/) account (test keys are fine for development)
- An SMTP account for email (Gmail with App Password works out of the box)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/eventconnect-platform.git
cd eventconnect-platform

# 2. Install backend dependencies
cd backend
npm install
```

### Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=event_system

# JWT
JWT_SECRET=your_long_random_secret_here

# Razorpay (use test keys during development)
RAZORPAY_KEY=rzp_test_xxxxxxxxxxxx
RAZORPAY_SECRET=your_razorpay_secret

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

> **Important:** Never commit `.env` to version control. Add it to `.gitignore`.

### Database Setup

#### Fresh install

```bash
mysql -u root -p < database/event_system.sql
```

#### Upgrading an existing database

Run the migration block at the bottom of `event_system.sql`:

```sql
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Other';
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT DEFAULT NULL;
-- See event_system.sql for the full CASCADE foreign-key migration steps
```

### Running the App

```bash
# Start the backend server
cd backend
npm start
# → Server running on port 5000

# Serve the frontend
# Option 1 – VS Code Live Server (recommended for development)
# Option 2 – any static file server, e.g.:
npx serve ../frontend
# Option 3 – open HTML files directly in the browser
```

---

## API Endpoints

### Auth — `/auth`

| Method | Path        | Description              | Auth |
|--------|-------------|--------------------------|------|
| POST   | `/register` | Create a new user account | —   |
| POST   | `/login`    | Login, returns JWT token  | —   |

### Events — `/events`

| Method | Path             | Description                        | Auth       |
|--------|------------------|------------------------------------|------------|
| GET    | `/`              | List all active (non-deleted) events | —        |
| POST   | `/`              | Create a new event                 | Organizer  |
| DELETE | `/:id`           | Soft-delete an event               | Organizer  |
| GET    | `/organizer`     | Organizer's events + stats         | Organizer  |
| GET    | `/:id/registrations` | Registrations for an event    | Organizer  |

### Registration — `/register`

| Method | Path       | Description                                     | Auth |
|--------|------------|-------------------------------------------------|------|
| POST   | `/`        | Create a PENDING registration                   | User |
| GET    | `/status`  | Check registration + payment status for an event | User |

### Payment — `/payment`

| Method | Path       | Description                                      | Auth |
|--------|------------|--------------------------------------------------|------|
| POST   | `/order`   | Create a Razorpay order                          | User |
| POST   | `/verify`  | Verify HMAC signature and confirm payment as PAID | User |
| POST   | `/failed`  | Mark a payment/registration as FAILED            | User |

### User Events — `/user/events`

| Method | Path | Description                            | Auth |
|--------|------|----------------------------------------|------|
| GET    | `/`  | List all PAID registrations for the user | User |

---

## Frontend Pages

| Page                       | Route                        | Description                              |
|----------------------------|------------------------------|------------------------------------------|
| Event Discovery            | `index.html`                 | Browse events + interactive map          |
| Login                      | `login.html`                 | User / organizer login                   |
| Register                   | `register.html`              | New account creation                     |
| User Dashboard             | `user-dashboard.html`        | View registered events with map          |
| Organizer Dashboard        | `organizer-dashboard.html`   | Revenue charts, event management         |
| Create Event               | `create-event.html`          | Form to publish a new event              |
| Payment                    | `payment.html`               | Razorpay checkout                        |

---

## Payment Flow

```
User clicks "Register"
        │
        ▼
POST /register  →  Creates PENDING registration
        │
        ├── Free event?  →  Immediately marks PAID  →  Done ✅
        │
        └── Paid event?
                │
                ▼
        POST /payment/order  →  Razorpay order created
                │
                ▼
        Razorpay checkout modal opens in browser
                │
                ├── Success  →  POST /payment/verify
                │               Backend validates HMAC signature
                │               On match → registration = PAID ✅
                │
                └── Failure / Cancel  →  POST /payment/failed
                                         registration = FAILED ❌
```

HMAC verification is performed exclusively on the backend using `razorpay_order_id + razorpay_payment_id` — it cannot be bypassed from the client.

---

## Map Integration

EventConnect uses **Leaflet.js** with **OpenStreetMap** tiles — completely free, no API key required.

- **Event Discovery page:** all event locations are geocoded via [Nominatim](https://nominatim.openstreetmap.org/) and shown as red pins. The user's current location appears as a blue dot (browser geolocation).
- **Event detail modal:** a mini map renders the route from the user's location to the event venue using **Leaflet Routing Machine** (powered by OSRM). Falls back to a dashed straight line if routing is unavailable.
- Maps are **lazy-loaded** so they don't slow down the initial page render.

---

## Security Notes

- Passwords are hashed with **bcrypt** before storage.
- All protected routes verify a **JWT Bearer token** from the `Authorization` header.
- Razorpay payment confirmation uses **HMAC-SHA256** validation on the backend — the frontend receives only a success/failure response.
- `.env` contains secrets; ensure it is in `.gitignore` and never pushed to a public repository.
- The provided `.env` in this repository contains **placeholder / revoked** credentials. Generate your own before deploying.

---

