import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { Resend } from 'resend';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
await mkdir(dir, { recursive: true });
async function read(name, fallback) {
  try { return JSON.parse(await readFile(path.join(dir, name), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function write(name, value) {
  const target = path.join(dir, name);
  await writeFile(target + '.tmp', JSON.stringify(value, null, 2));
  await rename(target + '.tmp', target);
}
let tasks = await read('tasks.json', []);
if (!Array.isArray(tasks)) throw new Error('tasks.json must be an array.');
let delivery = await read('delivery.json', { lastSentAt: null, lastScheduledDate: null, lastError: null });
let busy = false;
const configured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.FROM_EMAIL);
const state = () => ({ tasks, delivery, configured: configured() });

cron.schedule('14 22 * * *', async () => {
  if (busy || !tasks.length) return;
  busy = true;
  try {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (delivery.lastScheduledDate === date) return;
    if (!configured()) throw new Error('Set RESEND_API_KEY, EMAIL_FROM (sender), and FROM_EMAIL (recipient).');
    const payload = { from: process.env.EMAIL_FROM, to: process.env.FROM_EMAIL, subject: 'Your daily tasks', text: JSON.stringify(tasks, null, 2) };
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send(payload, { idempotencyKey: 'tasks/' + date + '/' + hash });
    if (error) throw new Error(error.message);
    delivery = { lastSentAt: new Date().toISOString(), lastScheduledDate: date, lastError: null };
    await write('delivery.json', delivery);
  } catch (e) {
    delivery = { ...delivery, lastError: e.message };
    await write('delivery.json', delivery);
    console.error('Daily email failed:', e.message);
  } finally { busy = false; }
}, { timezone: 'Asia/Dubai', noOverlap: true });

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  const allowed = ['http://127.0.0.1:5173', 'http://localhost:5173', req.protocol + '://' + req.get('host'), process.env.RENDER_EXTERNAL_URL];
  if (origin && !allowed.includes(origin)) return res.status(403).json({ error: 'Origin not allowed.' });
  res.set('Cache-Control', 'no-store');
  next();
});
app.get('/api/tasks', (req, res) => res.json(state()));
function validate(input) {
  if (typeof input?.task !== 'string' || !input.task.trim() || input.task.trim().length > 500) throw new Error('Enter a task of 1 to 500 characters.');
  if (!Number.isSafeInteger(input.minutes) || input.minutes < 1 || input.minutes > 10080) throw new Error('Minutes must be a whole number between 1 and 10,080.');
  return { task: input.task.trim(), minutes: input.minutes };
}
async function mutate(res, operation) {
  if (busy) return res.status(409).json({ error: 'Another operation is in progress. Try again.' });
  busy = true;
  try {
    const next = operation();
    await write('tasks.json', next);
    tasks = next;
    res.json(state());
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  finally { busy = false; }
}
function find(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index < 0) throw Object.assign(new Error('Task not found. Refresh the page.'), { status: 404 });
  return index;
}
app.post('/api/tasks', (req, res) => mutate(res, () => {
  if (tasks.length >= 100) throw new Error('You can save up to 100 tasks.');
  return [...tasks, { id: randomUUID(), ...validate(req.body) }];
}));
app.put('/api/tasks/:id', (req, res) => mutate(res, () => {
  const index = find(req.params.id);
  const next = [...tasks];
  next[index] = { id: req.params.id, ...validate(req.body) };
  return next;
}));
app.delete('/api/tasks/:id', (req, res) => mutate(res, () => {
  find(req.params.id);
  return tasks.filter(t => t.id !== req.params.id);
}));
app.use(express.static(path.join(root, 'dist')));
app.use((error, req, res, next) => res.status(500).json({ error: 'The server could not complete this request.' }));
const host = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
const port = process.env.PORT || 3001;
app.listen(port, host, () => console.log('Morning Tasks listening on ' + host + ':' + port));