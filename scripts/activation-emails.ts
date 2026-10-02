/**
 * Day-1 and follow-up mail for activation.
 *
 * Sends nothing unless ALL of these are set:
 *   ACTIVATION_EMAILS_ENABLED=true
 *   RESEND_API_KEY
 *   ACTIVATION_EMAIL_FROM
 *   NEXTAUTH_URL (or APP_URL)
 *   NEXTAUTH_SECRET
 *
 * Guests are skipped. Opt-out is an audit_log row (activation_email_opt_out)
 * written by GET /api/email/opt-out. Each send is recorded as
 * activation_email_day1 or activation_email_followup so the next run skips it.
 *
 *   npx tsx scripts/activation-emails.ts
 */
import { isActivationEmailEnabled, runActivationEmailPass } from '@/lib/activation-email';
import { log } from '@/lib/logger';

async function main() {
  if (!isActivationEmailEnabled()) {
    log({ event: 'activation_email_disabled', sent: 0 });
    console.log(JSON.stringify({ sent: 0, reason: 'disabled' }));
    return;
  }

  const { deliverActivationEmail, loadActivationEmailCandidates } = await import('@/lib/activation-email-load');
  const now = new Date();
  const result = await runActivationEmailPass({
    enabled: true,
    now,
    load: () => loadActivationEmailCandidates(now),
    send: deliverActivationEmail,
  });
  log({ event: 'activation_email_pass', sent: result.sent });
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  log({ event: 'activation_email_failed', level: 'error', error });
  process.exitCode = 1;
});
