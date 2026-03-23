import { getLastMessageTime, hasCleanExit } from './db.js';
import type { SchedulerResult } from './types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Check if it's within quiet hours (8pm-9am EST).
 * All times evaluated in America/New_York timezone.
 */
function isQuietHours(): boolean {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estTime.getHours();
  // Quiet: 8pm (20) through 8:59am (8)
  return hour >= 20 || hour < 9;
}

/**
 * Check all sending rules before allowing a message.
 * - Max 1 SMS per contact per 24 hours
 * - No sends between 8pm-9am EST
 * - No sends after a clean-exit was delivered
 */
export async function canSend(contactId: string): Promise<SchedulerResult> {
  // Rule 1: Quiet hours
  if (isQuietHours()) {
    return { allowed: false, reason: 'Quiet hours (8pm-9am EST). Message will not be sent.' };
  }

  // Rule 2: Clean exit = permanent no-contact
  const cleanExitSent = await hasCleanExit(contactId);
  if (cleanExitSent) {
    return { allowed: false, reason: 'Clean exit already sent. Contact is permanently closed.' };
  }

  // Rule 3: Max 1 SMS per 24 hours
  const lastSent = await getLastMessageTime(contactId);
  if (lastSent) {
    const elapsed = Date.now() - lastSent.getTime();
    if (elapsed < ONE_DAY_MS) {
      const hoursLeft = Math.ceil((ONE_DAY_MS - elapsed) / (60 * 60 * 1000));
      return {
        allowed: false,
        reason: `Rate limited. Last SMS sent ${Math.round(elapsed / (60 * 60 * 1000))}h ago. Wait ~${hoursLeft}h.`,
      };
    }
  }

  return { allowed: true };
}

export { isQuietHours };
