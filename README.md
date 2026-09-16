# Morning Tasks

React page to add, update, and delete tasks with a duration in whole minutes. Tasks are saved in data/tasks.json as an array:

```json
[
  { "id": "generated-uuid", "task": "Plan the day", "minutes": 25 }
]
```

Every day at **11:00am Asia/Dubai**, Resend emails the saved JSON to FROM_EMAIL if the task array is not empty. Tasks remain saved after sending. Deleting all tasks stops the emails.

## Environment

Set these in your local .env or Render environment settings:

```env
RESEND_API_KEY=re_your_new_key
EMAIL_FROM=Morning Tasks <hello@your-verified-domain.com>
FROM_EMAIL=you@example.com
```

EMAIL_FROM is the verified Resend sender. FROM_EMAIL is the recipient.

## Run locally

Install Node.js 22.12+, run npm install then npm run dev, and open http://127.0.0.1:5173.

## Render

Use a Web Service with Root Directory blank, Build Command npm install && npm run build, and Start Command npm start. Render supplies PORT.

Use an always-running instance for the 11am job. Mount a persistent disk at /var/data and set DATA_DIR=/var/data to preserve JSON across deployments and restarts. Run one instance. Without persistent storage, saved tasks can be lost on deployment.

The page currently has no authentication; anyone with the URL can edit tasks. Missed runs while the server is off are not sent later. Failed sends are recorded in delivery.json with the next attempt the next day. Resend acceptance does not guarantee inbox delivery.
## Task timers and emails

The 11am email includes a designed task list and a Start timer button for each task, plus a plain-text JSON fallback. Clicking Start timer in the email opens the page and automatically starts that task. No second click is required. The linked page starts the server timer; the email itself does not execute JavaScript. Reopening the link while that task has a pending timer does not start a duplicate.

Each timer uses its task duration when started. The server saves timers in timers.json and checks for completion every 10 seconds. It emails FROM_EMAIL when the timer expires, with failed sends retried every minute. Timers continue if you close the page and resume after server restarts when persistent storage is configured. Editing or deleting a task does not cancel its already-started timer.

On Render, RENDER_EXTERNAL_URL supplies the email link address automatically. Set APP_URL if using a custom domain. Locally, links default to http://127.0.0.1:5173; set APP_URL for the built app.

Keep the server always running with a persistent disk; a sleeping server delays completion emails until it wakes. Notifications confirm timer expiration, not manual verification that the work was done.