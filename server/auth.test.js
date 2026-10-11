import test from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET = 'test-secret';
const { hashPassword, verifyPassword, signToken, verifyToken, tooMany } = await import('./auth.js');

test('hashes and verifies passwords', () => {
  const h = hashPassword('correct horse'); assert.notEqual(h, 'correct horse');
  assert.ok(verifyPassword('correct horse', h)); assert.ok(!verifyPassword('wrong', h)); assert.ok(!verifyPassword('x', 'garbage'));
  assert.notEqual(hashPassword('same'), hashPassword('same'));
});
test('tokens round-trip, reject tampering and expiry', () => {
  const t = signToken({ sub: 'u_1' }); assert.equal(verifyToken(t).sub, 'u_1');
  const [h, , s] = t.split('.'); const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'u_2', exp: 9999999999 })).toString('base64url')}.${s}`;
  assert.equal(verifyToken(forged), null); assert.equal(verifyToken(signToken({ sub: 'u_1' }, -5)), null); assert.equal(verifyToken('nope'), null);
});
test('throttles repeated attempts', () => { let blocked = false; for (let i = 0; i < 12; i++) blocked = tooMany('ip:test', 10); assert.ok(blocked); });
