import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeSession,
  encodeSession,
  isAdminAuthConfigured,
  verifyAdminCredentials,
} from "../../apps/web/src/lib/admin-session";

const TEST_USERNAME = "regression-admin";
const TEST_PASSWORD = "regression-password-101";
const TEST_SECRET = "regression-session-secret-2026";

process.env.ADMIN_USERNAME = TEST_USERNAME;
process.env.ADMIN_PASSWORD = TEST_PASSWORD;
process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

test("valid credentials succeed and wrong credentials fail", () => {
  assert.equal(isAdminAuthConfigured(), true);
  assert.equal(verifyAdminCredentials(TEST_USERNAME, TEST_PASSWORD), true);
  assert.equal(verifyAdminCredentials(TEST_USERNAME, "wrong-password"), false);
  assert.equal(verifyAdminCredentials("wrong-user", TEST_PASSWORD), false);
  assert.equal(verifyAdminCredentials("", ""), false);
});

test("missing configuration disables auth", () => {
  const previousUsername = process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_USERNAME;
  try {
    assert.equal(isAdminAuthConfigured(), false);
    assert.equal(verifyAdminCredentials(TEST_USERNAME, TEST_PASSWORD), false);
  } finally {
    process.env.ADMIN_USERNAME = previousUsername;
  }
});

test("valid signed sessions round-trip", () => {
  const iat = Math.floor(Date.now() / 1000);
  const token = encodeSession({ username: TEST_USERNAME, iat });
  const decoded = decodeSession(token);
  assert.deepEqual(decoded, { username: TEST_USERNAME, iat });
});

test("forged and tampered sessions are rejected", () => {
  const iat = Math.floor(Date.now() / 1000);
  const token = encodeSession({ username: TEST_USERNAME, iat });
  const [version, body, signature] = token.split(".");

  assert.equal(decodeSession(`${version}.${body}.AAAA${signature?.slice(3)}`), null);
  assert.equal(decodeSession(`${version}.${body}tampered.${signature}`), null);
  assert.equal(decodeSession(`v2.${body}.${signature}`), null);
  assert.equal(decodeSession("not-a-token"), null);
  assert.equal(decodeSession(""), null);
});

test("sessions signed with a different secret are rejected", () => {
  const token = encodeSession({ username: TEST_USERNAME, iat: Math.floor(Date.now() / 1000) });
  process.env.ADMIN_SESSION_SECRET = "rotated-secret-value";
  try {
    assert.equal(decodeSession(token), null);
  } finally {
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;
  }
});

test("expired sessions are rejected", () => {
  const eightDaysAgo = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
  const token = encodeSession({ username: TEST_USERNAME, iat: eightDaysAgo });
  assert.equal(decodeSession(token), null);
});
