import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { hashPassword, verifyPassword, signToken, requireAuth, tooMany } from './auth.js';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const app = express();
const PORT = process.env.PORT || 5050;
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));

// ---- Storage: MongoDB when MONGODB_URI is set, otherwise the local JSON file (handy for quick local runs) ----
let col = null, ucol = null;
async function connectStore() {
  if (!process.env.MONGODB_URI) { console.log('Storage: local JSON file (set MONGODB_URI to use MongoDB)'); return; }
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  col = client.db(process.env.MONGODB_DB || 'scopeshield').collection('projects');
  ucol = client.db(process.env.MONGODB_DB || 'scopeshield').collection('users'); await ucol.createIndex({ email: 1 }, { unique: true });
  await col.createIndex({ id: 1 }, { unique: true }); await col.createIndex({ shareToken: 1 });
  if (!(await col.countDocuments()) && process.env.SEED_SAMPLE !== 'false') {
    const seed = JSON.parse(await fs.readFile(DB_PATH, 'utf8')).projects; if (seed.length) await col.insertMany(seed);
  }
  console.log('Storage: MongoDB connected');
}
async function readDb() {
  if (!col) return JSON.parse(await fs.readFile(DB_PATH, 'utf8'));
  return { projects: await col.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray() };
}
async function writeDb(db) {
  if (!col) return fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
  const ops = db.projects.map(p => ({ replaceOne: { filter: { id: p.id }, replacement: p, upsert: true } }));
  if (ops.length) await col.bulkWrite(ops);
  await col.deleteMany({ id: { $nin: db.projects.map(p => p.id) } });
}
const same = (u, by) => Object.entries(by).every(([k, v]) => u[k] === v);
async function getUser(by) { if (ucol) return ucol.findOne(by, { projection: { _id: 0 } }); return ((await readDb()).users || []).find(u => same(u, by)) || null; }
async function addUser(u) { if (ucol) return void await ucol.insertOne({ ...u }); const db = await readDb(); (db.users ||= []).push(u); await writeDb(db); }
async function countUsers() { if (ucol) return ucol.countDocuments(); return ((await readDb()).users || []).length; }
async function adoptOrphans(id) { if (col) return void await col.updateMany({ ownerId: { $exists: false } }, { $set: { ownerId: id } }); const db = await readDb(); db.projects.forEach(p => { if (!p.ownerId) p.ownerId = id; }); await writeDb(db); }
const publicUser = u => ({ id: u.id, name: u.name, email: u.email });
function cleanString(value, max = 180) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; }
function notFound(res, message = 'Resource not found') { return res.status(404).json({ error: message }); }

async function readDbTokens() { const db = await readDb(); let dirty = false; for (const p of db.projects) if (!p.shareToken) { p.shareToken = nanoid(12); dirty = true; } if (dirty) await writeDb(db); return db; }
const side = (c) => c.proposedBy === 'freelancer' ? 'freelancer' : 'client'; // older records count as client requests
const newChange = (b, by) => ({ id: `c_${nanoid(8)}`, title: cleanString(b.title, 120), description: cleanString(b.description, 500), cost: money(b.cost), days: Math.max(0, Math.min(365, Number(b.days) || 0)), status: 'Pending', proposedBy: by, createdAt: new Date().toISOString() });
const findShared = (db, token) => db.projects.find(p => p.shareToken && p.shareToken === token);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'ScopeShield API', storage: col ? 'mongodb' : 'json-file', timestamp: new Date().toISOString() }));

// ---- Authentication ----
app.post('/api/auth/register', async (req, res, next) => {
  try {
    if (tooMany(`reg:${req.ip}`, 8)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    const name = cleanString(req.body.name, 60), email = cleanString(req.body.email, 120).toLowerCase(), password = typeof req.body.password === 'string' ? req.body.password : '';
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (await getUser({ email })) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    const first = (await countUsers()) === 0;
    const user = { id: `u_${nanoid(10)}`, name, email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    await addUser(user); if (first) await adoptOrphans(user.id); // the first account inherits any sample or pre-login projects
    res.status(201).json({ token: signToken({ sub: user.id }), user: publicUser(user) });
  } catch (e) { next(e); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = cleanString(req.body.email, 120).toLowerCase(), password = typeof req.body.password === 'string' ? req.body.password : '';
    if (tooMany(`login:${req.ip}:${email}`, 8)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    const user = await getUser({ email });
    if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: 'Incorrect email or password.' });
    res.json({ token: signToken({ sub: user.id }), user: publicUser(user) });
  } catch (e) { next(e); }
});
app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try { const u = await getUser({ id: req.user.id }); return u ? res.json(publicUser(u)) : res.status(401).json({ error: 'Please sign in to continue.' }); } catch (e) { next(e); }
});
// ---- Authorization: every project route below belongs to the signed-in owner only ----
app.use(['/api/projects', '/api/dashboard'], requireAuth);
const own = (db, req) => db.projects.find(p => p.id === req.params.id && p.ownerId === req.user.id);

app.get('/api/dashboard', async (req, res, next) => {
  try {
    const projects = (await readDb()).projects.filter(p => p.ownerId === req.user.id);
    const allChanges = projects.flatMap(p => p.changes.map(c => ({ ...c, projectId: p.id, projectName: p.name, client: p.client })));
    const pending = allChanges.filter(c => c.status === 'Pending');
    const approvedExtra = allChanges.filter(c => c.status === 'Approved').reduce((sum, c) => sum + c.cost, 0);
    const active = projects.filter(p => p.status === 'In progress');
    res.json({
      stats: { activeProjects: active.length, pendingChanges: pending.length, pendingValue: pending.reduce((s, c) => s + c.cost, 0), protectedValue: projects.reduce((s, p) => s + p.budget, 0) + approvedExtra },
      projects: projects.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
      activity: allChanges.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
    });
  } catch (e) { next(e); }
});

app.get('/api/projects', async (req, res, next) => {
  try {
    const projects = (await readDbTokens()).projects.filter(p => p.ownerId === req.user.id);
    const q = cleanString(req.query.q, 100).toLowerCase();
    const status = cleanString(req.query.status, 30);
    res.json(projects.filter(p => (!q || `${p.name} ${p.client} ${p.type}`.toLowerCase().includes(q)) && (!status || status === 'All projects' || p.status === status)));
  } catch (e) { next(e); }
});

app.post('/api/projects', async (req, res, next) => {
  try {
    const name = cleanString(req.body.name, 100); const client = cleanString(req.body.client, 100);
    if (!name || !client) return res.status(400).json({ error: 'Project name and client are required.' });
    const db = await readDb();
    const project = {
      id: `p_${nanoid(8)}`, name, client, type: cleanString(req.body.type, 50) || 'Other', status: 'In progress', ownerId: req.user.id,
      budget: money(req.body.budget), dueDate: cleanString(req.body.dueDate, 20), createdAt: new Date().toISOString(),
      summary: cleanString(req.body.summary, 500), deliverables: Array.isArray(req.body.deliverables) ? req.body.deliverables.map(v => cleanString(v, 140)).filter(Boolean).slice(0, 20) : [],
      exclusions: Array.isArray(req.body.exclusions) ? req.body.exclusions.map(v => cleanString(v, 140)).filter(Boolean).slice(0, 20) : [], changes: [], shareToken: nanoid(12)
    };
    db.projects.unshift(project); await writeDb(db); res.status(201).json(project);
  } catch (e) { next(e); }
});

app.get('/api/projects/:id', async (req, res, next) => {
  try { const db = await readDb(); const project = own(db, req); return project ? res.json(project) : notFound(res, 'Project not found'); }
  catch (e) { next(e); }
});

app.patch('/api/projects/:id', async (req, res, next) => {
  try {
    const db = await readDb(); const p = own(db, req); if (!p) return notFound(res, 'Project not found');
    for (const key of ['name', 'client', 'type', 'status', 'dueDate', 'summary']) if (req.body[key] !== undefined) p[key] = cleanString(req.body[key], key === 'summary' ? 500 : 180);
    if (req.body.budget !== undefined) p.budget = money(req.body.budget);
    if (Array.isArray(req.body.deliverables)) p.deliverables = req.body.deliverables.map(v => cleanString(v, 140)).filter(Boolean).slice(0, 20);
    if (Array.isArray(req.body.exclusions)) p.exclusions = req.body.exclusions.map(v => cleanString(v, 140)).filter(Boolean).slice(0, 20);
    await writeDb(db); res.json(p);
  } catch (e) { next(e); }
});

app.delete('/api/projects/:id', async (req, res, next) => {
  try { const db = await readDb(); const n = db.projects.length; db.projects = db.projects.filter(p => !(p.id === req.params.id && p.ownerId === req.user.id)); if (db.projects.length === n) return notFound(res, 'Project not found'); await writeDb(db); res.json({ success: true }); }
  catch (e) { next(e); }
});

app.post('/api/projects/:id/changes', async (req, res, next) => {
  try {
    const title = cleanString(req.body.title, 120); if (!title) return res.status(400).json({ error: 'A change request title is required.' });
    const db = await readDb(); const p = own(db, req); if (!p) return notFound(res, 'Project not found');
    const change = newChange(req.body, 'freelancer');
    p.changes.unshift(change); await writeDb(db); res.status(201).json(change);
  } catch (e) { next(e); }
});

app.patch('/api/projects/:id/changes/:changeId', async (req, res, next) => {
  try {
    const db = await readDb(); const p = own(db, req); if (!p) return notFound(res, 'Project not found');
    const c = p.changes.find(c => c.id === req.params.changeId); if (!c) return notFound(res, 'Change request not found');
    if (!['Pending', 'Approved', 'Declined'].includes(req.body.status)) return res.status(400).json({ error: 'Status must be Pending, Approved or Declined.' });
    if (req.body.status !== 'Pending' && side(c) === 'freelancer') return res.status(403).json({ error: 'You proposed this change, so the client has to approve or decline it.' });
    c.status = req.body.status; c.decidedBy = 'freelancer'; c.decidedAt = new Date().toISOString(); await writeDb(db); res.json(c);
  } catch (e) { next(e); }
});

// ---- Client side of the shared deal (no login: the private link is the key) ----
app.get('/api/share/:token', async (req, res, next) => {
  try { const p = findShared(await readDbTokens(), req.params.token); if (!p) return notFound(res, 'This link is not valid.'); const { ownerId, ...pub } = p; return res.json(pub); } catch (e) { next(e); }
});
app.post('/api/share/:token/changes', async (req, res, next) => {
  try {
    if (!cleanString(req.body.title, 120)) return res.status(400).json({ error: 'Tell the freelancer what you would like to change.' });
    const db = await readDbTokens(); const p = findShared(db, req.params.token); if (!p) return notFound(res, 'This link is not valid.');
    const c = newChange(req.body, 'client'); p.changes.unshift(c); await writeDb(db); res.status(201).json(c);
  } catch (e) { next(e); }
});
app.patch('/api/share/:token/changes/:changeId', async (req, res, next) => {
  try {
    const db = await readDbTokens(); const p = findShared(db, req.params.token); if (!p) return notFound(res, 'This link is not valid.');
    const c = p.changes.find(c => c.id === req.params.changeId); if (!c) return notFound(res, 'Change request not found');
    if (!['Approved', 'Declined'].includes(req.body.status)) return res.status(400).json({ error: 'Status must be Approved or Declined.' });
    if (side(c) !== 'freelancer') return res.status(403).json({ error: 'You asked for this change, so the freelancer has to approve it.' });
    c.status = req.body.status; c.decidedBy = 'client'; c.decidedAt = new Date().toISOString(); await writeDb(db); res.json(c);
  } catch (e) { next(e); }
});

app.get('/api/projects/:id/export', async (req, res, next) => {
  try {
    const db = await readDb(); const p = own(db, req); if (!p) return notFound(res, 'Project not found');
    const lines = [`# ${p.name}`, '', `**Client:** ${p.client}`, `**Project type:** ${p.type}`, `**Status:** ${p.status}`, `**Base budget:** ₹${p.budget.toLocaleString('en-IN')}`, `**Target date:** ${p.dueDate || 'Not set'}`, '', '## Overview', p.summary || 'No overview provided.', '', '## Included deliverables', ...(p.deliverables.length ? p.deliverables.map(v => `- ${v}`) : ['- No deliverables listed']), '', '## Not included', ...(p.exclusions.length ? p.exclusions.map(v => `- ${v}`) : ['- No exclusions listed']), '', '## Change requests', ...(p.changes.length ? p.changes.map(c => `- **${c.title}** — ${c.status}; +₹${c.cost.toLocaleString('en-IN')}; +${c.days} day(s)\n  ${c.description || ''}`) : ['- No change requests recorded']), '', '---', 'Generated with ScopeShield. Please confirm scope and commercial terms with all parties before work begins.', ''];
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-scope.md"`); res.send(lines.join('\n'));
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Something went wrong on the server.' }); });
connectStore().then(() => app.listen(PORT, () => console.log(`ScopeShield API running on http://localhost:${PORT}`))).catch(e => { console.error('Could not connect to MongoDB:', e.message); process.exit(1); });
