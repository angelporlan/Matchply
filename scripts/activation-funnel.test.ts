import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sql = readFileSync(path.join(process.cwd(), 'scripts/activation-funnel.sql'), 'utf8');

test('activation funnel reads audit_log and the 5 minute window', () => {
  assert.match(sql, /FROM audit_log\b/);
  assert.doesNotMatch(sql, /FROM audit_logs\b/);
  assert.match(sql, /action = 'user_register'/);
  assert.match(sql, /action = 'cv_optimize_ai'/);
  assert.match(sql, /action = 'cv_download_pdf'/);
  assert.match(sql, /interval '5 minutes'/);
  assert.match(sql, /activated_pct/);
  assert.match(sql, /"userId"/);
  assert.match(sql, /"createdAt"/);
});
