import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { Resend } from 'resend';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.join(root, 'data');
const settingsPath = path.join(dataDir, 'settings.json');
await mkdir(dataDir, { recursive: true });
let settings = {
  to: '', subject: 'Your morning reminder',
  message: 'Good morning! Take a moment to plan your day and focus on what matters.',
  timezone: 'Asia/Dubai', enabled: false,
  lastSentAt: null, lastScheduledDate: null, lastError: null
};
try { settings = { ...settings, ...JSON.parse(await readFile(settingsPath, 'utf8')) }; }
catch (error) { if (error.code !== 'ENOENT') throw error; }

async function save(next) {
  await writeFile(`${settingsPath}.tmp`, JSON.stringify(next, null, 2));
  await rename(`${settingsPath}.tmp`, settingsPath);
  settings = next;
}
const configured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
function validate(input) {
  if (typeof input.to !== 'string' || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(input.to.trim())) throw new Error('Enter one valid recipient email.');
  if (typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 200) throw new Error('Enter a subject of up to 200 characters.');
  if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 20000) throw new Error('Enter a message of up to 20,000 characters.');
  if (typeof input.timezone !== 'string') throw new Error('Choose a valid timezone.');
  try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { throw new Error('Choose a valid timezone.'); }
  if (typeof input.enabled !== 'boolean') throw new Error('Invalid schedule setting.');
  if (input.enabled && !configured()) throw new Error('Configure RESEND_API_KEY and EMAIL_FROM in .env first.');
  return { to: input.to.trim(), subject: input.subject.trim(), message: input.message, timezone: input.timezone, enabled: input.enabled };
}
let busy = false;
async function send(scheduled = false) {
  if (busy) throw new Error('An email is already being sent. Try again shortly.');
  if (!configured()) throw new Error('Configure RESEND_API_KEY and EMAIL_FROM in .env first.');
  const snapshot = { ...settings };
  validate(snapshot);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: snapshot.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (scheduled && snapshot.lastScheduledDate === date) return;
  busy = true;
  try {
    const payload = { from: process.env.EMAIL_FROM, to: snapshot.to, subject: snapshot.subject, text: snapshot.message };
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);
    const idempotencyKey = scheduled ? `morning/${date}/${hash}` : `test/${randomUUID()}`;
    const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send(payload, { idempotencyKey });
    if (error) throw new Error(error.message);
    await save({ ...settings, lastSentAt: new Date().toISOString(), lastError: null, ...(scheduled ? { lastScheduledDate: date } : {}) });
    return data;
  } catch (error) {
    await save({ ...settings, lastError: error.message });
    throw error;
  } finally { busy = false; }
}
let task;
function schedule() {
  task?.destroy();
  task = cron.schedule('0 11 * * *', async () => {
    if (!settings.enabled) return;
    try { await send(true); } catch (error) { console.error('Daily email failed:', error.message); }
  }, { timezone: settings.timezone, noOverlap: true });
}
schedule();
const app = express();
app.use(express.json({ limit: '64kb' }));
// Local-only dashboard; reject cross-origin browser mutations.
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && !['http://127.0.0.1:5173', 'http://localhost:5173', `http://127.0.0.1:${process.env.PORT || 3001}`, `http://localhost:${process.env.PORT || 3001}`].includes(origin)) return res.status(403).json({ error: 'Origin not allowed.' });
  next();
});
app.get('/api/settings', (req, res) => res.json({ ...settings, configured: configured(), from: process.env.EMAIL_FROM || '' }));
app.put('/api/settings', async (req, res) => {
  if (busy) return res.status(409).json({ error: 'Please wait for the current operation to finish.' });
  busy = true;
  try {
    const input = validate(req.body);
    await save({ ...settings, ...input });
    schedule();
    res.json({ ...settings, configured: configured(), from: process.env.EMAIL_FROM || '' });
  } catch (error) { res.status(400).json({ error: error.message }); }
  finally { busy = false; }
});
app.post('/api/send-test', async (req, res) => {
  try { res.json({ data: await send() }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
app.use(express.static(path.join(root, 'dist')));
app.use((error, req, res, next) => res.status(500).json({ error: 'The server could not complete this request.' }));
app.listen(process.env.PORT || 3001, '127.0.0.1', () => console.log(`Morning Mail: http://127.0.0.1:${process.env.PORT || 3001}`));
