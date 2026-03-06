import { eq, desc } from 'drizzle-orm';
import { getDatabase } from '../database';
import {
  analysisResults,
  type AnalysisResult,
  type NewAnalysisResult,
} from '../schema';

/**
 * T089: Repository for AnalysisResult CRUD operations
 */
export class AnalysisResultRepository {
  async create(
    data: Omit<NewAnalysisResult, 'id' | 'createdAt'>,
  ): Promise<AnalysisResult> {
    const db = await getDatabase();
    const newResult: NewAnalysisResult = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
    };

    const [created] = await db.insert(analysisResults).values(newResult).returning();
    if (!created) throw new Error('Failed to create analysis result');
    return created;
  }

  async findById(id: string): Promise<AnalysisResult | undefined> {
    const db = await getDatabase();
    const [result] = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.id, id))
      .limit(1);
    return result;
  }

  async findByIncidentId(incidentId: string): Promise<AnalysisResult[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.incidentId, incidentId))
      .orderBy(desc(analysisResults.createdAt));
  }

  async findByToolName(toolName: string): Promise<AnalysisResult[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.toolName, toolName))
      .orderBy(desc(analysisResults.createdAt));
  }

  async findSuccessfulByIncidentId(incidentId: string): Promise<AnalysisResult[]> {
    const db = await getDatabase();
    return db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.incidentId, incidentId))
      .orderBy(desc(analysisResults.createdAt));
  }

  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await this.findById(id);
    if (!result) return false;
    await db.delete(analysisResults).where(eq(analysisResults.id, id));
    return true;
  }

  async deleteByIncidentId(incidentId: string): Promise<number> {
    const db = await getDatabase();
    const existing = await this.findByIncidentId(incidentId);
    for (const r of existing) {
      await db.delete(analysisResults).where(eq(analysisResults.id, r.id));
    }
    return existing.length;
  }
}

export const analysisResultRepository = new AnalysisResultRepository();
