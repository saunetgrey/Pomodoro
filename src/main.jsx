import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function App() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try { const data = await api('/api/settings'); setForm(data); setSaved(data); setError(''); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  const change = (key, value) => { setForm(current => ({ ...current, [key]: value })); setNotice(''); };
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setForm(data); setSaved(data); setNotice('Settings saved.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/send-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await api('/api/settings'); setSaved(data); setForm(data);
      setNotice('Test email accepted by Resend. Check your inbox.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const dirty = form && saved && ['to', 'subject', 'message', 'timezone', 'enabled'].some(key => form[key] !== saved[key]);
  return <main>
    <header><a className="brand" href="/">☀ <span>morning mail</span></a><span className="provider">Powered by Resend ↗</span></header>
    <section className="intro"><span className="eyebrow">A LITTLE ROUTINE. A BETTER DAY.</span><h1>A good morning,<br /><em>delivered.</em></h1><p>One email, every day at 11am.<br />Set your message. Let your morning take care of itself.</p></section>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert" role="status">{notice}</div>}
    {!form ? <div className="card"><p>Connecting to your email scheduler…</p><button onClick={load}>Retry connection</button></div> : <div className="layout">
      <form className="card" onSubmit={save}><div className="card-heading"><h2>Your daily email</h2><span className="tag">DAILY ROUTINE</span></div>
        {!form.configured && <p className="setup">Add your Resend API key and verified sender to .env to start sending.</p>}
        <fieldset disabled={busy}><label htmlFor="to">Send to</label><input id="to" type="email" required placeholder="you@example.com" value={form.to} onChange={e => change('to', e.target.value)} />
          <label htmlFor="subject">Subject</label><input id="subject" required maxLength={200} value={form.subject} onChange={e => change('subject', e.target.value)} />
          <label htmlFor="message">Message</label><textarea id="message" required maxLength={20000} rows={7} value={form.message} onChange={e => change('message', e.target.value)} />
          <label htmlFor="timezone">Timezone</label><input id="timezone" required list="timezones" value={form.timezone} onChange={e => change('timezone', e.target.value)} /><datalist id="timezones">{['Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'].map(zone => <option key={zone} value={zone} />)}</datalist>
          <div className="enable"><div><strong>Daily delivery</strong><p>Send automatically at 11:00am.</p></div><input aria-label="Enable daily delivery" type="checkbox" checked={form.enabled} onChange={e => change('enabled', e.target.checked)} /></div>
          <div className="actions"><button className="primary" type="submit">{busy ? 'Working…' : 'Save settings'} <span>↗</span></button><button type="button" disabled={busy || dirty || !saved.to || !saved.configured} onClick={test}>Send test email</button></div>
          {dirty && <small>Save your changes before sending a test.</small>}</fieldset>
      </form>
      <aside><div className="schedule-card"><span className="eyebrow">YOUR SCHEDULE</span><div className="time">11:00<span>AM</span></div><p>Every morning · {saved.timezone}</p><div className={'status ' + (saved.enabled ? 'active' : '')}><span />{saved.enabled ? 'Daily delivery enabled' : 'Schedule paused'}</div><hr /><p className="detail">{saved.lastSentAt ? `Last accepted: ${new Date(saved.lastSentAt).toLocaleString()}` : 'Your first morning email is waiting.'}</p>{saved.lastError && <p className="error-text">Last send failed: {saved.lastError}</p>}</div>
        <div className="note"><span>✉</span><h3>A moment for yourself.</h3><p>A reminder, a daily intention, or a little encouragement. Make it something you’ll look forward to opening.</p></div></aside>
    </div>}
    <footer>Made for a calmer morning.<span>11am, every day.</span></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
