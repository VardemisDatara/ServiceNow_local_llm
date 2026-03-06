import { eq, desc, and } from 'drizzle-orm';
import { getDatabase } from '../database';
import {
  securityIncidents,
  type SecurityIncident,
  type NewSecurityIncident,
} from '../schema';

/**
 * T088: Repository for SecurityIncident CRUD operations
 */
export class SecurityIncidentRepository {
  async create(
    data: Omit<NewSecurityIncident, 'id' | 'createdAt'>,
  ): Promise<SecurityIncident> {
    const db = await getDatabase();
    const newIncident: NewSecurityIncident = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
    };

    const [created] = await db.insert(securityIncidents).values(newIncident).returning();
    if (!created) throw new Error('Failed to create security incident');
    return created;
  }

  async findById(id: string): Promise<SecurityIncident | undefined> {
    const db = await getDatabase();
    const [incident] = await db
      .select()
      .from(securityIncidents)
      .where(eq(securityIncidents.id, id))
      .limit(1);
    return incident;
  }

  async findBySessionId(sessionId: string): Promise<SecurityIncident[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(securityIncidents)
      .where(eq(securityIncidents.sessionId, sessionId))
      .orderBy(desc(securityIncidents.createdAt));
  }

  async findByStatus(
    status: SecurityIncident['status'],
  ): Promise<SecurityIncident[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(securityIncidents)
      .where(eq(securityIncidents.status, status))
      .orderBy(desc(securityIncidents.createdAt));
  }

  async findBySeverity(
    severity: SecurityIncident['severity'],
  ): Promise<SecurityIncident[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(securityIncidents)
      .where(eq(securityIncidents.severity, severity))
      .orderBy(desc(securityIncidents.createdAt));
  }

  async findBySessionAndStatus(
    sessionId: string,
    status: SecurityIncident['status'],
  ): Promise<SecurityIncident[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(securityIncidents)
      .where(
        and(
          eq(securityIncidents.sessionId, sessionId),
          eq(securityIncidents.status, status),
        ),
      )
      .orderBy(desc(securityIncidents.createdAt));
  }

  async updateStatus(
    id: string,
    status: SecurityIncident['status'],
  ): Promise<SecurityIncident> {
    const db = await getDatabase();
    const updates: Partial<SecurityIncident> = { status };
    if (status === 'analyzed') {
      updates.analyzedAt = new Date();
    }

    const [updated] = await db
      .update(securityIncidents)
      .set(updates)
      .where(eq(securityIncidents.id, id))
      .returning();

    if (!updated) throw new Error(`Security incident not found: ${id}`);
    return updated;
  }

  async updateAnalysis(
    id: string,
    analysis: {
      threatLevel?: SecurityIncident['threatLevel'];
      cveIds?: string[];
      correlatedIncidents?: string[];
      status?: SecurityIncident['status'];
    },
  ): Promise<SecurityIncident> {
    const db = await getDatabase();
    const updates: Partial<SecurityIncident> = {};

    if (analysis.threatLevel !== undefined) updates.threatLevel = analysis.threatLevel;
    if (analysis.cveIds !== undefined) updates.cveIds = JSON.stringify(analysis.cveIds);
    if (analysis.correlatedIncidents !== undefined)
      updates.correlatedIncidents = JSON.stringify(analysis.correlatedIncidents);
    if (analysis.status !== undefined) {
      updates.status = analysis.status;
      if (analysis.status === 'analyzed') updates.analyzedAt = new Date();
    }

    const [updated] = await db
      .update(securityIncidents)
      .set(updates)
      .where(eq(securityIncidents.id, id))
      .returning();

    if (!updated) throw new Error(`Security incident not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const incident = await this.findById(id);
    if (!incident) return false;
    await db.delete(securityIncidents).where(eq(securityIncidents.id, id));
    return true;
  }
}

export const securityIncidentRepository = new SecurityIncidentRepository();
