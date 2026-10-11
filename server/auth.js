// Authentication helpers with zero extra dependencies: scrypt password hashing + HS256 JWTs.
import crypto from 'node:crypto';

const SECRET = process.env.JWT_SECRET || (() => {
  console.warn('WARNING: JWT_SECRET is not set. Using a temporary secret, so logins reset on every restart. Set JWT_SECRET in production.');
  return crypto.randomBytes(32).toString('hex');
})();
const b64 = v => Buffer.from(v).toString('base64url');
const sign = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':'); if (!salt || !hash) return false;
  const a = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function signToken(payload, ttlSeconds = 7 * 24 * 3600) {
  const body = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }))}`;
  return `${body}.${sign(body)}`;
}
export function verifyToken(token) {
  const parts = String(token || '').split('.'); if (parts.length !== 3) return null;
  const good = sign(`${parts[0]}.${parts[1]}`), a = Buffer.from(parts[2]), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString()); return p.exp > Date.now() / 1000 ? p : null; } catch { return null; }
}
// Express middleware: only signed-in users get through. Sets req.user = { id }.
export function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); const p = m && verifyToken(m[1]);
  if (!p) return res.status(401).json({ error: 'Please sign in to continue.' });
  req.user = { id: p.sub }; next();
}
// Tiny in-memory throttle for login/register attempts (per key, per window).
const hits = new Map();
export function tooMany(key, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < windowMs); list.push(now); hits.set(key, list); return list.length > limit;
}
