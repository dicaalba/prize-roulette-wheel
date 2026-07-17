# Prize Roulette Wheel

A web-based prize roulette wheel application with real-time stock management, built with zero external dependencies.

## Features

- Canvas-based animated roulette wheel
- Admin panel for prize management
- QR Display screen for events
- Real-time stock updates via WebSocket
- SQLite database for persistence
- Spanish UI

## Tech Stack

- **Backend:** Node.js (Express + WebSocket + SQLite) — all built-in, zero external deps
- **Frontend:** Vanilla HTML/CSS/JS with Canvas API
- **Database:** SQLite (via native `node:sqlite` module)

## Setup

```bash
cd prize-roulette-wheel
npm install  # (no dependencies needed - zero external deps!)
node src/server.js
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ADMIN_PASSWORD` | `admin123` | Admin panel password |
| `MEETUP_URL` | — | URL for meetup event link |
| `WEB_APP_URL` | — | Public URL of the web app |

You can copy `.env.example` to `.env` and customize these values.

## URLs

- **http://localhost:3000/** — Roulette wheel (player view)
- **http://localhost:3000/admin** — Admin panel (prize management)
- **http://localhost:3000/display** — QR Display screen (for projectors/TVs at events)

## Project Structure

```
├── public/
│   ├── index.html          # Main roulette wheel page
│   ├── css/styles.css      # Global styles
│   ├── js/                 # Client-side modules
│   │   ├── app.js
│   │   ├── wheelRenderer.js
│   │   ├── spinEngine.js
│   │   ├── animationController.js
│   │   ├── resultModal.js
│   │   └── wsClient.js
│   ├── admin/              # Admin panel
│   └── display/            # QR Display screen
├── src/
│   ├── server.js           # Main server entry point
│   ├── db/database.js      # SQLite database layer
│   ├── middleware/auth.js  # Authentication middleware
│   ├── routes/prizes.js    # Prize API routes
│   └── services/           # Business logic
│       ├── prizeService.js
│       ├── spinService.js
│       └── wsManager.js
├── data/                   # SQLite database (gitignored)
├── package.json
└── .env.example
```

## License

MIT
