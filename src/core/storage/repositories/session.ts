import { eq, desc, and, lt } from 'drizzle-orm';
import { getDatabase } from '../database';
import {
  aiSessions,
  type AISession,
  type NewAISession,
} from '../schema';
import { logger } from '../../../utils/logger';

/**
 * T043: Repository for AISession CRUD operations
 */
export class AISessionRepository {
  async create(data: Omit<NewAISession, 'id' | 'createdAt' | 'lastActiveAt'>): Promise<AISession> {
    logger.debug('Creating AI session', { configId: data.configId, title: data.title });
    const db = await getDatabase();
    const now = new Date();
    const newSession: NewAISession = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: now,
      lastActiveAt: now,
    };

    const [created] = await db.insert(aiSessions).values(newSession).returning();
    if (!created) throw new Error('Failed to create AI session');
    logger.info('AI session created', { id: created.id, title: created.title });
    return created;
  }

  async findById(id: string): Promise<AISession | undefined> {
    const db = await getDatabase();
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id)).limit(1);
    return session;
  }

  async findByConfigId(configId: string): Promise<AISession[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(aiSessions)
      .where(eq(aiSessions.configId, configId))
      .orderBy(desc(aiSessions.lastActiveAt));
  }

  async findSaved(): Promise<AISession[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(aiSessions)
      .where(eq(aiSessions.isSaved, true))
      .orderBy(desc(aiSessions.lastActiveAt));
  }

  async findAll(): Promise<AISession[]> {
    const db = await getDatabase();
    return db.select().from(aiSessions).orderBy(desc(aiSessions.lastActiveAt));
  }

  async updateLastActive(id: string): Promise<void> {
    const db = await getDatabase();
    await db
      .update(aiSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(aiSessions.id, id));
  }

  async incrementMessageCount(id: string): Promise<void> {
    const db = await getDatabase();
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id)).limit(1);
    if (session) {
      await db
        .update(aiSessions)
        .set({ messageCount: session.messageCount + 1, lastActiveAt: new Date() })
        .where(eq(aiSessions.id, id));
    }
  }

  async save(id: string, title?: string): Promise<AISession> {
    const db = await getDatabase();
    const updates: Partial<AISession> = { isSaved: true };
    if (title) updates.title = title;

    const [updated] = await db
      .update(aiSessions)
      .set(updates)
      .where(eq(aiSessions.id, id))
      .returning();

    if (!updated) throw new Error(`Session not found: ${id}`);
    return updated;
  }

  async updateTitle(id: string, title: string): Promise<AISession> {
    const db = await getDatabase();
    const [updated] = await db
      .update(aiSessions)
      .set({ title })
      .where(eq(aiSessions.id, id))
      .returning();

    if (!updated) throw new Error(`Session not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    logger.debug('Deleting AI session', { id });
    const db = await getDatabase();
    const session = await this.findById(id);
    if (!session) return false;
    await db.delete(aiSessions).where(eq(aiSessions.id, id));
    logger.info('AI session deleted', { id });
    return true;
  }

  /** Delete all expired (non-saved) sessions */
  async deleteExpired(): Promise<number> {
    const db = await getDatabase();
    const now = new Date();
    const expired = await db
      .select()
      .from(aiSessions)
      .where(and(eq(aiSessions.isSaved, false), lt(aiSessions.expiresAt, now)));

    for (const session of expired) {
      await db.delete(aiSessions).where(eq(aiSessions.id, session.id));
    }
    return expired.length;
  }
}

export const aiSessionRepository = new AISessionRepository();
