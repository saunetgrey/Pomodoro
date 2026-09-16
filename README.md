# Morning Tasks

React page to add, update, and delete tasks with a duration in whole minutes. Tasks are saved in data/tasks.json as an array:

```json
[
  { "id": "generated-uuid", "task": "Plan the day", "minutes": 25 }
]
```

Every day at **11am Asia/Dubai**, Resend emails the saved JSON to FROM_EMAIL if the task array is not empty. Tasks remain saved after sending. Deleting all tasks stops the emails.

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