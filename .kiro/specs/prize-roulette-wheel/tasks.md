# Implementation Plan: Prize Roulette Wheel

## Overview

This implementation plan covers a web-based prize roulette wheel application with real-time stock management, an admin panel, and a QR display screen. The stack is Node.js + Express + Socket.IO + SQLite (via better-sqlite3) for the backend, and Vanilla HTML/CSS/JS with Canvas for the frontend. Tasks are organized to build foundational layers first (database, services), then API routes, then frontend pages, with testing interspersed throughout.

## Tasks

- [ ] 1. Set up project structure and dependencies
  - [ ] 1.1 Initialize project and install dependencies
    - Create `package.json` with project metadata
    - Install production dependencies: `express`, `socket.io`, `better-sqlite3`, `jsonwebtoken`, `qrcode`
    - Install dev dependencies: `vitest`, `fast-check`, `supertest`, `@types/better-sqlite3`
    - Create directory structure: `src/`, `src/services/`, `src/middleware/`, `src/db/`, `src/routes/`, `public/`, `public/js/`, `public/css/`, `public/admin/`, `public/display/`
    - Create `.env.example` with `PORT`, `ADMIN_PASSWORD`, `DB_PATH`, `WEB_APP_URL`, `MEETUP_URL`
    - _Requirements: 12.1, 12.2_

  - [ ] 1.2 Create server entry point and configuration
    - Create `src/server.js` with Express app initialization
    - Configure static file serving for `public/` directory
    - Set up environment variable loading (dotenv or process.env)
    - Define `ServerConfig` interface values from environment
    - Wire up HTTP server for Socket.IO attachment
    - Add route mounting placeholders for `/api` and page routes
    - _Requirements: 12.1, 12.2_

- [ ] 2. Implement database layer
  - [ ] 2.1 Create SQLite database initialization and schema
    - Create `src/db/database.js`
    - Implement `initialize()` function that creates tables if not exist
    - Create `prizes` table with columns: `id`, `name`, `description`, `color`, `stock`, `is_no_prize`, `sort_order`, `created_at`, `updated_at`
    - Create `config` table with `key`/`value` columns
    - Enable WAL mode for concurrent read performance
    - Seed default config values (meetup_url, consolation_message, web_app_url)
    - _Requirements: 9.4, 12.1_

  - [ ] 2.2 Implement prize CRUD database operations
    - Implement `getPrizes()` — return all prizes ordered by `sort_order`
    - Implement `getPrizeById(id)` — return single prize or null
    - Implement `insertPrize(data)` — validate and insert with generated ID
    - Implement `updatePrize(id, data)` — partial update with `updated_at` timestamp
    - Implement `deletePrize(id)` — remove prize by ID, return success boolean
    - Implement `decrementStock(id)` — atomic `UPDATE ... SET stock = stock - 1 WHERE id = ? AND stock > 0`, return `{ success, newStock }`
    - Implement `getConfig()` — return all config key/value pairs
    - _Requirements: 9.2, 9.4, 9.6, 12.1, 12.6, 12.8_

  - [ ]* 2.3 Write property test for stock decrement exactness
    - **Property 9: Stock decrement exactness**
    - Generate random initial stock values (1-100), perform decrement, assert new stock === initial - 1
    - **Validates: Requirements 9.2**

  - [ ]* 2.4 Write property test for persistence round-trip
    - **Property 11: Prize data persistence round-trip**
    - Generate random valid prize data (name, description, color, stock), insert then read back, assert equality
    - **Validates: Requirements 9.4, 12.1**

  - [ ]* 2.5 Write property test for concurrency safety
    - **Property 12: Concurrency safety — stock never negative**
    - Set prize stock to 1, run N concurrent decrement attempts (N in 2-20), assert stock never goes below 0 and at most 1 succeeds
    - **Validates: Requirements 9.6, 12.8**

  - [ ]* 2.6 Write property test for stock validation
    - **Property 15: Stock validation rejects invalid values**
    - Generate random invalid stock values (negative, floats, strings, null), assert rejection on insert/update
    - **Validates: Requirements 12.6**

- [ ] 3. Checkpoint - Database layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement backend services
  - [ ] 4.1 Implement PrizeService
    - Create `src/services/prizeService.js`
    - Implement `getAllPrizes()` — delegates to database layer
    - Implement `getPrizeById(id)` — delegates to database layer
    - Implement `createPrize(data)` — validate input (name length 1-30, non-negative integer stock, non-empty color), enforce segment count ≤ 12, insert
    - Implement `updatePrize(id, data)` — validate partial fields, delegate to database
    - Implement `deletePrize(id)` — enforce minimum 4 segments and at least 1 no-prize segment remains, then delete
    - Implement `decrementStock(prizeId)` — delegate to database atomic decrement
    - Implement `getAvailablePrizes()` — return prizes with stock > 0
    - Validate segment constraints: minimum 4, maximum 12, at least 1 no-prize
    - _Requirements: 6.2, 9.2, 9.6, 10.4, 10.5, 10.6, 12.6_

  - [ ] 4.2 Implement SpinService
    - Create `src/services/spinService.js`
    - Implement `executeSpin()` method:
      - Fetch all prizes to build wheel segments (replace stock=0 with "Sin Premio")
      - Select random winning segment index
      - If winning segment is a prize (not no-prize), attempt atomic stock decrement
      - If decrement fails (race condition), return "no_prize" outcome
      - Return `SpinResult` with outcome, prize info, segment index, and updated prize list
    - Implement `computeWheelSegments(prizes)` — maps prizes to display segments per design
    - _Requirements: 3.4, 9.2, 9.3, 9.5, 9.6, 12.8_

  - [ ] 4.3 Implement WebSocket Manager
    - Create `src/services/wsManager.js`
    - Implement `initialize(io)` — set up connection handler
    - On new connection: send `prizes:initial` event with full prize list
    - Implement `broadcastStockUpdate(prizes)` — emit `stock:updated` to all clients
    - Implement `broadcastPrizeListUpdate(prizes)` — emit `prizes:updated` to all clients
    - Implement `sendInitialState(socket)` — send current prizes to single socket
    - _Requirements: 12.2, 12.3, 12.4, 12.7_

  - [ ]* 4.4 Write property test for CRUD operations correctness
    - **Property 14: CRUD operations correctness**
    - Generate random sequences of create/update/delete operations, verify prize list state matches expected after each operation
    - **Validates: Requirements 10.4, 10.5, 10.6, 12.5**

  - [ ]* 4.5 Write property test for configuration validation
    - **Property 1: Configuration validation preserves structure**
    - Generate random valid prize configurations (4-12 segments, valid fields, at least one no-prize), validate and assert 1:1 mapping preserved
    - **Validates: Requirements 6.1, 6.2, 6.3, 9.1**

- [ ] 5. Implement auth middleware and REST API routes
  - [ ] 5.1 Implement auth middleware
    - Create `src/middleware/auth.js`
    - Implement `POST /api/auth/login` handler — compare password to `ADMIN_PASSWORD` env var, return JWT token on match, 401 on mismatch
    - Implement `authenticate` middleware — verify `Authorization: Bearer <token>` header on protected routes
    - Token expiry: 8 hours
    - _Requirements: 10.2, 10.3_

  - [ ] 5.2 Implement REST API routes
    - Create `src/routes/prizes.js`
    - `GET /api/prizes` — return all prizes (no auth required)
    - `POST /api/prizes` — create prize (auth required), validate input, broadcast update via WebSocket
    - `PUT /api/prizes/:id` — update prize (auth required), validate input, broadcast update
    - `DELETE /api/prizes/:id` — delete prize (auth required), enforce constraints, broadcast update
    - `POST /api/spin` — execute spin via SpinService, broadcast stock update
    - `GET /api/config` — return app config (meetup_url, web_app_url, consolation_message)
    - Add proper error responses with status codes and validation details
    - _Requirements: 10.4, 10.5, 10.6, 12.3, 12.4, 12.5_

  - [ ]* 5.3 Write property test for authentication rejection
    - **Property 13: Authentication rejection for invalid credentials**
    - Generate random strings that don't match the admin password, assert all are rejected with 401
    - **Validates: Requirements 10.2, 10.3**

- [ ] 6. Checkpoint - Backend services and API
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement frontend roulette wheel page
  - [ ] 7.1 Create wheel renderer (Canvas)
    - Create `public/js/wheelRenderer.js`
    - Implement `render(canvas, segments)` — draw pie segments using Canvas arc API
    - Calculate equal angular sizes: `360 / segmentCount` degrees per segment
    - Draw colored segments with distinct fills
    - Render prize name text within each segment (rotated for readability)
    - Draw center circle and outer border for visual polish
    - Draw pointer/marker indicator at top of wheel
    - _Requirements: 1.1, 1.2, 1.3, 6.4_

  - [ ] 7.2 Create spin engine
    - Create `public/js/spinEngine.js`
    - Implement `calculateSpin(segmentIndex, segmentCount)` — return `{ totalRotation, duration }`
    - Calculate total rotation: `(randomRotations * 360) + segmentTargetAngle` where randomRotations is 3-6
    - Ensure minimum 1080 degrees (3 full rotations)
    - Calculate duration: random between 3000ms and 6000ms
    - Calculate segment target angle to align pointer with center of winning segment
    - _Requirements: 3.2, 3.4, 3.5, 7.2_

  - [ ] 7.3 Create animation controller
    - Create `public/js/animationController.js`
    - Implement `spin(wheelElement, rotation, duration)` — returns Promise
    - Apply CSS `transition` with `cubic-bezier(0.17, 0.67, 0.12, 0.99)` easing
    - Set `transform: rotate(Xdeg)` to trigger animation
    - Listen for `transitionend` event to resolve Promise
    - Track cumulative rotation to avoid angle resets between spins
    - Implement `reset(wheelElement)` for initial state
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 7.4 Create result modal component
    - Create `public/js/resultModal.js`
    - Implement `show(result)` — display modal with prize name or "Sin Premio" heading
    - Display prize description for prize outcomes
    - Display consolation message for no-prize outcomes
    - Always render Meetup button with text "Síguenos en Meetup para reclamar tu premio"
    - Meetup button opens configured URL in new tab (`target="_blank"`)
    - Implement `hide()` — close modal, trigger callback for re-enabling spin
    - Implement close button (X) and overlay click to dismiss
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 8.1, 8.2_

  - [ ] 7.5 Create main roulette wheel page (HTML/CSS/JS)
    - Create `public/index.html` — page structure with canvas, spin button, modal container
    - Create `public/css/styles.css` — responsive layout, wheel styling, modal styles, button styles
    - Create `public/js/app.js` — main orchestrator:
      - Initialize WebSocket connection
      - Fetch initial prize data and render wheel
      - Handle spin button click: disable button, call API, animate wheel, show modal
      - Handle modal close: re-enable button
      - Handle WebSocket updates: re-render wheel segments on prize changes
    - Implement state machine: Connecting → Idle → Spinning → AwaitResult → ShowResult → Idle
    - Spin button labeled "Girar", disabled during spin/modal
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.3, 8.3_

  - [ ]* 7.6 Write property test for equal angular segment size
    - **Property 2: Equal angular segment size**
    - Generate random N in [4, 12], assert each segment angle === 360/N and sum === 360
    - **Validates: Requirements 6.4**

  - [ ]* 7.7 Write property test for spin rotation alignment
    - **Property 3: Spin rotation aligns with winning segment**
    - Generate random segment count (4-12) and random winning index, assert final angle within segment bounds
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 7.8 Write property test for minimum rotation guarantee
    - **Property 4: Minimum rotation guarantee**
    - Generate random segment count and winning index, assert totalRotation >= 1080
    - **Validates: Requirements 7.2**

  - [ ]* 7.9 Write property test for spin duration bounds
    - **Property 5: Spin duration within bounds**
    - Generate random spin calculations, assert duration between 3000ms and 6000ms
    - **Validates: Requirements 3.2**

- [ ] 8. Checkpoint - Frontend roulette wheel
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Admin Panel
  - [ ] 9.1 Create admin panel HTML and CSS
    - Create `public/admin/index.html` — login form, prize management table, add/edit forms
    - Create `public/admin/admin.css` — admin-specific styles, table layout, form styles
    - Include login screen with password input and submit button
    - Prize table columns: Name, Color (swatch), Stock, Description, Actions (Edit/Delete)
    - Add prize form: name, description, color picker, stock number input, isNoPrize checkbox
    - Edit prize modal/inline form with pre-filled values
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.6_

  - [ ] 9.2 Create admin panel JavaScript
    - Create `public/admin/admin.js`
    - Implement `login(password)` — POST to `/api/auth/login`, store token in localStorage
    - Implement `loadPrizes()` — GET `/api/prizes`, render table
    - Implement `addPrize(data)` — POST `/api/prizes` with auth header
    - Implement `editPrize(id, data)` — PUT `/api/prizes/:id` with auth header
    - Implement `deletePrize(id)` — DELETE `/api/prizes/:id` with auth header, confirm dialog
    - Connect WebSocket: update prize table in real time when stock changes (from spins)
    - Display real-time Prize_Stock values via `stock:updated` events
    - Handle validation errors: display field-level messages from API response
    - _Requirements: 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

- [ ] 10. Implement QR Display Screen
  - [ ] 10.1 Create QR display screen HTML and CSS
    - Create `public/display/index.html` — two-column layout (QR code + prize list)
    - Create `public/display/display.css` — large-screen optimized styles (min 1024px viewport)
    - Include QR code container (large, centered in left panel)
    - Include prize list container (right panel) with name and stock for each prize
    - Style depleted prizes (stock=0) with strikethrough/gray
    - Use large fonts and high contrast for readability from a distance
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6_

  - [ ] 10.2 Create QR display screen JavaScript
    - Create `public/display/display.js`
    - Implement `renderQRCode(url)` — use `qrcode` library to generate QR code image from web app URL
    - Implement `updatePrizeList(prizes)` — render prize list with names and stock counts
    - Mark stock=0 prizes with visual "unavailable" indicator (grayed out, strikethrough)
    - Connect WebSocket: listen for `prizes:updated` and `stock:updated` events
    - On `stock:updated`: update specific prize stock display
    - On `prizes:updated`: re-render full prize list (handles add/remove)
    - Fetch initial data on page load via `prizes:initial` WebSocket event
    - _Requirements: 11.3, 11.4, 11.5, 11.7, 12.3, 12.4_

  - [ ]* 10.3 Write property test for QR display prize list accuracy
    - **Property 16: QR display prize list accuracy**
    - Generate random prize lists, verify display function output shows all prizes with correct names and stocks, stock=0 marked unavailable
    - **Validates: Requirements 11.3, 11.5**

- [ ] 11. Implement WebSocket client and real-time integration
  - [ ] 11.1 Create shared WebSocket client module
    - Create `public/js/wsClient.js`
    - Implement `connect()` — establish Socket.IO connection to backend
    - Implement automatic reconnection with exponential backoff (1s initial, 2x multiplier, 30s max)
    - On reconnect: receive `prizes:initial` event and replace local state
    - Implement `onPrizesUpdated(callback)` — register handler for `prizes:updated` event
    - Implement `onStockUpdated(callback)` — register handler for `stock:updated` event
    - Implement `disconnect()` — clean disconnection
    - _Requirements: 12.2, 12.7_

  - [ ] 11.2 Wire WebSocket into all frontend pages
    - In `public/js/app.js`: on `prizes:updated` re-compute wheel segments and re-render canvas
    - In `public/admin/admin.js`: on `stock:updated` update stock column in real time
    - In `public/display/display.js`: on `prizes:updated` and `stock:updated` update display
    - Ensure state synchronization happens within 1-2 seconds of backend changes
    - _Requirements: 12.3, 12.4, 12.7_

- [ ] 12. Implement responsive design and mobile optimization
  - [ ] 12.1 Add responsive CSS and mobile viewport handling
    - Add viewport meta tag to all HTML pages
    - Implement CSS media queries for mobile (320px-768px) on roulette wheel page
    - Scale canvas/wheel to fit mobile viewport width
    - Ensure spin button is easily tappable (min 44px touch target)
    - Make modal responsive: full-screen on mobile, centered on desktop
    - Ensure QR display is optimized for 1024px+ (large text, large QR)
    - Admin panel: responsive table that scrolls horizontally on small screens
    - _Requirements: 2.3, 11.6_

- [ ] 13. Checkpoint - All pages and WebSocket integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Property-based tests for UI logic
  - [ ]* 14.1 Write property test for state machine button invariant
    - **Property 6: State machine button invariant**
    - Simulate random sequences of spin → close cycles, assert button disabled during spinning/showResult, enabled only in idle
    - **Validates: Requirements 3.3, 8.3**

  - [ ]* 14.2 Write property test for modal content matches outcome
    - **Property 7: Modal content matches outcome**
    - Generate random spin outcomes (prize/no-prize), assert modal heading matches name, description shown for prizes, consolation for no-prize
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 14.3 Write property test for Meetup button always present
    - **Property 8: Meetup button always present**
    - Generate random outcomes, assert Meetup button with correct text and URL always present
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 14.4 Write property test for segment display matches stock
    - **Property 10: Segment display matches stock status**
    - Generate random prize lists with varying stocks, assert stock>0 shows prize segment, stock=0 shows "Sin Premio"
    - **Validates: Requirements 9.3, 9.5**

- [ ] 15. Integration tests
  - [ ]* 15.1 Write integration test for full spin flow
    - Test: POST /api/spin returns valid SpinResult, decrements stock, broadcasts via WebSocket
    - Verify spin with depleted prize returns "no_prize" outcome
    - Verify concurrent spins don't over-decrement stock
    - _Requirements: 3.4, 9.2, 9.6, 12.3, 12.8_

  - [ ]* 15.2 Write integration test for admin CRUD and broadcast
    - Test: Create/Update/Delete prize via API, verify persistence and WebSocket broadcast
    - Test: Verify authentication required for mutations (401 without token)
    - Test: Verify deletion blocked when segment count would drop below 4
    - _Requirements: 10.4, 10.5, 10.6, 10.8, 12.4, 12.5_

  - [ ]* 15.3 Write integration test for WebSocket reconnection
    - Test: Client reconnects after disconnection and receives full state via `prizes:initial`
    - Test: State after reconnection matches current server state
    - _Requirements: 12.7_

- [ ] 16. Final wiring and server startup
  - [ ] 16.1 Wire all components together in server entry point
    - Import and initialize database on startup
    - Mount API routes (`/api/prizes`, `/api/spin`, `/api/auth/login`, `/api/config`)
    - Serve static pages: `/` → roulette, `/admin` → admin panel, `/display` → QR display
    - Initialize Socket.IO server and WebSocket Manager
    - Add error handling middleware (validation errors → 400, auth errors → 401, server errors → 500)
    - Add startup logging and graceful shutdown handler
    - Seed initial prizes if database is empty (at least 4 segments including 1 "Sin Premio")
    - _Requirements: 2.1, 10.1, 11.1, 12.1, 12.2_

- [ ] 17. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The backend uses Node.js + Express + Socket.IO + SQLite (better-sqlite3)
- The frontend is Vanilla HTML/CSS/JS with Canvas for wheel rendering
- All real-time communication uses Socket.IO with automatic reconnection
- Admin authentication uses JWT tokens with 8-hour expiry
- Atomic SQL statements prevent stock over-decrement under concurrency

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["7.1", "7.2", "9.1", "10.1"] },
    { "id": 7, "tasks": ["7.3", "7.4", "7.5", "9.2", "10.2"] },
    { "id": 8, "tasks": ["7.6", "7.7", "7.8", "7.9", "10.3", "11.1"] },
    { "id": 9, "tasks": ["11.2", "12.1"] },
    { "id": 10, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 11, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 12, "tasks": ["16.1"] }
  ]
}
```
