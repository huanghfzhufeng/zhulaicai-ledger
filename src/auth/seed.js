import { config } from '../config.js';
import { hashPassword, verifyPassword } from './password.js';
import { findByUsername, createUser, setPassword } from '../models/users.js';

/**
 * Ensure the single shared account exists and matches the configured password.
 * The `.env` (LEDGER_USERNAME / LEDGER_PASSWORD) is the source of truth, so
 * changing the password there and restarting rotates it in place.
 * Runs once at startup, before the server accepts requests.
 */
export async function ensureFixedAccount() {
  const { ledgerUsername, ledgerPassword } = config;
  const existing = findByUsername(ledgerUsername);

  if (!existing) {
    const passwordHash = await hashPassword(ledgerPassword);
    createUser({ username: ledgerUsername, passwordHash });
    return { username: ledgerUsername, action: 'created' };
  }

  const matches = await verifyPassword(ledgerPassword, existing.password_hash);
  if (!matches) {
    setPassword(existing.id, await hashPassword(ledgerPassword));
    return { username: ledgerUsername, action: 'password-updated' };
  }

  return { username: ledgerUsername, action: 'unchanged' };
}
