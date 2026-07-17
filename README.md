# Prize Roulette Wheel

A web-based prize roulette wheel application with real-time stock management, built with zero external dependencies.

## Features

- Canvas-based animated roulette wheel
- Admin panel for prize management
- QR Display screen for events
- Real-time stock updates via WebSocket
- JSON file-based persistence
- Spanish UI

## Tech Stack

- **Backend:** Node.js (HTTP + WebSocket) — all built-in, zero external deps
- **Frontend:** Vanilla HTML/CSS/JS with Canvas API
- **Database:** JSON file-based persistence

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
| `MEETUP_URL` | `https://www.meetup.com/aws-girls-peru/` | URL for meetup event link |
| `WEB_APP_URL` | `http://localhost:3000` | Public URL of the web app |

You can copy `.env.example` to `.env` and customize these values.

## URLs

- **http://localhost:3000/** — Roulette wheel (player view)
- **http://localhost:3000/admin** — Admin panel (prize management)
- **http://localhost:3000/display** — QR Display screen (for projectors/TVs at events)

## Deployment Options

### Option 1: All-in-One (Local/EC2)
```bash
node src/server.js
```
Everything runs on one server.

### Option 2: Split (GitHub Pages + AWS Lambda) — Recommended

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | GitHub Pages | https://dicaalba.github.io/prize-roulette-wheel/ |
| Backend | AWS Lambda | Your Lambda Function URL |

**Steps:**
1. Deploy the backend: `./deploy-aws.sh`
2. Copy your Lambda Function URL
3. Edit `public/js/config.js` and set `API_BASE_URL` to your Lambda URL
4. Push to main — GitHub Actions will deploy the frontend automatically

**Frontend URLs (GitHub Pages):**
- 🎰 Ruleta: https://dicaalba.github.io/prize-roulette-wheel/
- 🔐 Admin: https://dicaalba.github.io/prize-roulette-wheel/admin/
- 📺 Display: https://dicaalba.github.io/prize-roulette-wheel/display/

## Project Structure

```
├── public/
│   ├── index.html          # Main roulette wheel page
│   ├── css/styles.css      # Global styles
│   ├── js/                 # Client-side modules
│   │   ├── config.js       # Frontend configuration (API URL, etc.)
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
│   ├── server-handler.js   # Request handler (shared with Lambda)
│   ├── db/database.js      # JSON file-based database layer
│   ├── middleware/auth.js  # Authentication middleware
│   ├── routes/prizes.js    # Prize API routes
│   └── services/           # Business logic
│       ├── prizeService.js
│       ├── spinService.js
│       └── wsManager.js
├── .github/workflows/      # GitHub Actions
│   └── deploy-pages.yml    # Auto-deploy frontend to GitHub Pages
├── data/                   # Database (gitignored)
├── lambda.js               # AWS Lambda handler
├── deploy-aws.sh           # AWS deployment script
├── Dockerfile              # Container deployment
├── package.json
└── .env.example
```

## License

MIT
