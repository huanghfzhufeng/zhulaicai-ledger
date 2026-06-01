import { config } from '../config.js';
import { hashPassword, verifyPassword } from './password.js';
import { findByUsername, createUser, setPassword, setRole } from '../models/users.js';

/**
 * Ensure the preset accounts exist and match the configured password + role.
 * The `.env` is the source of truth, so changing a password there and
 * restarting rotates it in place. Runs once at startup, before serving.
 */
async function ensureAccount(username, password, role) {
  const existing = findByUsername(username);
  if (!existing) {
    const passwordHash = await hashPassword(password);
    createUser({ username, passwordHash, role });
    return { username, role, action: 'created' };
  }
  const matches = await verifyPassword(password, existing.password_hash);
  if (!matches) setPassword(existing.id, await hashPassword(password));
  if (existing.role !== role) setRole(existing.id, role);
  return { username, role, action: matches ? 'unchanged' : 'password-updated' };
}

export async function ensureAccounts() {
  const owner = await ensureAccount(config.ledgerUsername, config.ledgerPassword, 'owner');
  // Guard against owner/staff being misconfigured to the same username.
  const staff =
    config.staffUsername && config.staffUsername !== config.ledgerUsername
      ? await ensureAccount(config.staffUsername, config.staffPassword, 'staff')
      : null;
  return { owner, staff };
}
