import { eq, asc, desc, max } from 'drizzle-orm';
import { getDatabase } from '../database';
import {
  conversationMessages,
  type ConversationMessage,
  type NewConversationMessage,
} from '../schema';
import { logger } from '../../../utils/logger';

/**
 * T044: Repository for ConversationMessage CRUD operations
 */
export class ConversationMessageRepository {
  async create(data: Omit<NewConversationMessage, 'id' | 'timestamp'>): Promise<ConversationMessage> {
    logger.debug('Creating conversation message', { sessionId: data.sessionId, sender: data.sender });
    const db = await getDatabase();
    const newMessage: NewConversationMessage = {
      id: crypto.randomUUID(),
      ...data,
      timestamp: new Date(),
    };

    const [created] = await db.insert(conversationMessages).values(newMessage).returning();
    if (!created) throw new Error('Failed to create conversation message');
    logger.debug('Conversation message persisted', { id: created.id, sessionId: created.sessionId });
    return created;
  }

  async findBySessionId(sessionId: string): Promise<ConversationMessage[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.sessionId, sessionId))
      .orderBy(asc(conversationMessages.sequenceNumber));
  }

  async findById(id: string): Promise<ConversationMessage | undefined> {
    const db = await getDatabase();
    const [message] = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.id, id))
      .limit(1);
    return message;
  }

  async getLastSequenceNumber(sessionId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db
      .select({ maxSeq: max(conversationMessages.sequenceNumber) })
      .from(conversationMessages)
      .where(eq(conversationMessages.sessionId, sessionId));

    return result[0]?.maxSeq ?? 0;
  }

  async getNextSequenceNumber(sessionId: string): Promise<number> {
    return (await this.getLastSequenceNumber(sessionId)) + 1;
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    logger.debug('Deleting messages for session', { sessionId });
    const db = await getDatabase();
    const messages = await this.findBySessionId(sessionId);
    await db.delete(conversationMessages).where(eq(conversationMessages.sessionId, sessionId));
    logger.info('Session messages deleted', { sessionId, count: messages.length });
    return messages.length;
  }

  async getLatestMessages(sessionId: string, limit: number): Promise<ConversationMessage[]> {
    const db = await getDatabase();
    const all = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.sessionId, sessionId))
      .orderBy(desc(conversationMessages.sequenceNumber))
      .limit(limit);

    return all.reverse(); // Return in chronological order
  }
}

export const conversationMessageRepository = new ConversationMessageRepository();
