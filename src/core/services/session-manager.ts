import { aiSessionRepository } from '../storage/repositories/session';
import { logger } from '../../utils/logger';

/**
 * T055: Session lifecycle management — expiry, cleanup, timeout enforcement
 */

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/** Start periodic cleanup of expired sessions (runs every 30 minutes) */
export function startSessionCleanup(): void {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(async () => {
    try {
      const deleted = await aiSessionRepository.deleteExpired();
      if (deleted > 0) {
        logger.info('Session cleanup: removed expired sessions', { count: deleted });
      }
    } catch (err) {
      logger.warn('Session cleanup failed', {}, err as Error);
    }
  }, 30 * 60 * 1000); // 30 minutes

  logger.info('Session cleanup scheduler started');
}

export function stopSessionCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info('Session cleanup scheduler stopped');
  }
}

/** Check whether a session has expired */
export function isSessionExpired(session: { expiresAt: Date | null; isSaved: boolean }): boolean {
  if (session.isSaved || !session.expiresAt) return false;
  return session.expiresAt < new Date();
}
