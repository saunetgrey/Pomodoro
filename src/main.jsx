import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function App() {
  const [data, setData] = useState(null);
  const [task, setTask] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const selected = new URLSearchParams(window.location.search).get('task');
  async function load() {
    try { setData(await api('/api/tasks')); setError(''); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => { api('/api/tasks').then(setData).catch(() => {}); }, 10000);
    return () => { clearInterval(tick); clearInterval(refresh); };
  }, []);
  async function start(id) {
    setBusy(true); setError(''); setNotice('');
    try { setData(await api('/api/tasks/' + id + '/start', 'POST')); setNotice('Timer started. A completion email will follow when time is up.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function timerLabel(id) {
    const run = [...(data.runs || [])].reverse().find(run => run.taskId === id);
    if (!run) return '';
    const seconds = Math.max(0, Math.ceil((Date.parse(run.endsAt) - now) / 1000));
    if (seconds) return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' remaining';
    return run.notifiedAt ? 'Complete · email accepted' : run.lastError ? 'Complete · email retry pending: ' + run.lastError : 'Complete · sending notification';
  }
  function reset() { setEditing(null); setTask(''); setMinutes('25'); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      setData(await api(editing ? '/api/tasks/' + editing : '/api/tasks', editing ? 'PUT' : 'POST', { task, minutes: Number(minutes) }));
      setNotice(editing ? 'Task updated.' : 'Task added.'); reset();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(id) {
    setBusy(true); setError(''); setNotice('');
    try {
      setData(await api('/api/tasks/' + id, 'DELETE'));
      if (editing === id) reset();
      setNotice('Task deleted.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main>
    <header><a className="brand" href="/"><span>morning tasks</span></a><span className="provider">Powered by Resend</span></header>
    <section className="intro"><span className="eyebrow">MAKE TIME FOR WHAT MATTERS</span><h1>Your day,<br /><em>planned.</em></h1><p>Add your tasks and the time you need.<br />Your saved list arrives by email every morning at 11am.</p></section>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert" role="status">{notice}</div>}
    {!data ? <div className="card"><p>Connecting to your task list...</p><button onClick={load}>Retry connection</button></div> : <div className="layout">
      <div><form className="card" onSubmit={save}><h2>{editing ? 'Edit task' : 'Add a task'}</h2><fieldset disabled={busy}>
        <label htmlFor="task">Task</label><input id="task" required maxLength={500} placeholder="What would you like to work on?" value={task} onChange={e => setTask(e.target.value)} />
        <label htmlFor="minutes">Time in minutes</label><input id="minutes" type="number" required min="1" max="10080" step="1" value={minutes} onChange={e => setMinutes(e.target.value)} />
        <div className="actions task-actions"><button className="primary" type="submit">{busy ? 'Saving...' : editing ? 'Update task' : 'Add task'}</button>{editing && <button type="button" onClick={reset}>Cancel</button>}</div>
      </fieldset></form>
      <section className="card task-list"><div className="card-heading"><h2>Saved tasks</h2><span className="tag">{data.tasks.length} TASKS</span></div>
        {!data.tasks.length ? <p>No tasks yet. Add one above to start your daily email.</p> : <ul>{data.tasks.map(item => <li key={item.id} className={selected === item.id ? "selected-task" : ""}><div><strong>{item.task}</strong><small>{item.minutes} minutes</small><small role="status">{timerLabel(item.id)}</small></div><div className="row-actions"><button disabled={busy || (data.runs || []).some(run => run.taskId === item.id && !run.notifiedAt)} onClick={() => start(item.id)}>Start timer</button><button disabled={busy} onClick={() => { setEditing(item.id); setTask(item.task); setMinutes(String(item.minutes)); setNotice(''); }}>Edit</button><button disabled={busy} onClick={() => remove(item.id)}>Delete</button></div></li>)}</ul>}
      </section></div>
      <aside><div className="schedule-card"><span className="eyebrow">DAILY DELIVERY</span><div className="time">11:00<span>AM</span></div><p>Every day · Asia/Dubai</p><div className={'status ' + (data.tasks.length && data.configured ? 'active' : '')}><span />{!data.configured ? 'Email configuration needed' : data.tasks.length ? 'Daily email enabled' : 'Waiting for tasks'}</div><hr /><p>{data.tasks.reduce((total, item) => total + item.minutes, 0)} minutes planned</p><p>{data.delivery.lastSentAt ? 'Last accepted: ' + new Date(data.delivery.lastSentAt).toLocaleString() : 'No email sent yet.'}</p>{data.delivery.lastError && <p className="error-text">{data.delivery.lastError}</p>}</div>
        <section className="card json-card"><h2>Saved JSON</h2><pre>{JSON.stringify(data.tasks, null, 2)}</pre></section>
      </aside>
    </div>}
    <footer>Your tasks, delivered daily.<span>11am, Dubai time.</span></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
