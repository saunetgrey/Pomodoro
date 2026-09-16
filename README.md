# Morning Mail

React dashboard with a Node server that sends one email through Resend every day at **11:00am**, defaulting to **Asia/Dubai**. The schedule starts paused. Settings and delivery status are stored in `data/settings.json`.

## Run

Install Node.js 22.12+ and run:

```powershell
npm install
Copy-Item .env.example .env
```

Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`. Use a sender on a domain verified in your Resend account. Never put the API key in React or a `VITE_` variable.

```powershell
npm run dev
```

Open http://127.0.0.1:5173. Enter the recipient, subject, message, and timezone. Save, send a test if desired, then enable daily delivery and save again.

## Run the built app

```powershell
npm run build
npm start
```

Open http://127.0.0.1:3001. Keep the Node process running and the computer awake at 11am. Closing the browser is fine. Missed runs while the server is off are not sent later; failed sends are recorded and the next scheduled attempt is the following day. Resend acceptance does not guarantee inbox delivery.

This is a local, single-user app bound to loopback. For unattended hosting, run one persistent Node instance with persistent storage and a process manager. Add authentication before exposing the dashboard publicly. An in-process scheduler will not work on a serverless host that shuts down between requests.

Scheduled sends use a date and payload based idempotency key plus a persisted date marker to reduce duplicate sends. Resend retains idempotency keys for 24 hours: https://resend.com/docs/dashboard/emails/idempotency-keys.

Dependencies and runtime checks could not be run in the creation environment because Node.js/npm were unavailable.
