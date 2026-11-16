import { GoogleGenAI, Type } from '@google/genai';
import { warehouse } from './warehouse.ts';

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in the server environment.'
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export interface TextToSqlResponse {
  question: string;
  sql: string;
  explanation: string;
  answerSummary: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionMs: number;
}

export async function answerWarehouseQuestion(
  question: string
): Promise<TextToSqlResponse> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error('Please enter a commercial question to query the warehouse.');
  }

  const ai = getGeminiClient();
  const schemaContext = warehouse.getWarehouseSchemaPrompt();

  // Step 1: Translate natural language ask into verified SQLite SELECT query
  const sqlGen = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Translate this executive commercial question into a single SQLite SELECT query:\n\n"${trimmed}"`,
    config: {
      systemInstruction: `You are a senior analytics engineer querying a life-sciences commercial intelligence SQLite warehouse.
${schemaContext}

Rules:
1. Return ONLY a single valid SQLite SELECT or WITH...SELECT query. Never use INSERT/UPDATE/DELETE/PRAGMA.
2. When the user says "Q3" without specifying a year, compare or default clearly: if asking a single figure for Q3, check the most recent Q3 ('2026-Q3') AND/OR break down by fiscal_quarter IN ('2025-Q3', '2026-Q3') so both years are transparent!
3. Match exact string literals from the schema (e.g., 'Biopharma', 'CDMO', 'CRO', 'Academic', 'Clinical Lab', 'OEM', 'Catalog', 'Custom', 'Quiet', 'Under-Buying', 'Healthy').
4. Round dollar amounts with ROUND(..., 0) and percentages/ROAS with ROUND(..., 2). Give readable column aliases.
5. Limit detail lists to <= 50 rows unless aggregating.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sql: {
            type: Type.STRING,
            description: 'Valid read-only SQLite SELECT query.',
          },
          explanation: {
            type: Type.STRING,
            description:
              'One concise sentence explaining which mart/dimension tables and filters the SQL uses.',
          },
        },
        required: ['sql', 'explanation'],
      },
    },
  });

  const parsed = JSON.parse((sqlGen.text ?? '{}').trim()) as {
    sql?: string;
    explanation?: string;
  };

  if (!parsed.sql) {
    throw new Error('Model failed to produce a SQL query for this question.');
  }

  // Step 2: Execute validated read-only SQL against the live SQLite warehouse
  const queryResult = warehouse.executeSafeReadQuery(parsed.sql);

  // Step 3: Synthesize a concise executive answer grounded strictly in the executed rows
  const previewRows = queryResult.rows.slice(0, 20);
  const summaryGen = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Question: "${trimmed}"
Executed SQL:
${queryResult.sql}

Total rows returned: ${queryResult.rowCount}
Result rows (up to 20 shown):
${JSON.stringify(previewRows, null, 2)}

Write a crisp, executive 1-3 sentence commercial summary answering the question directly with exact dollar figures, percentages, or account names from the query results. Never invent numbers not in the rows.`,
  });

  return {
    question: trimmed,
    sql: queryResult.sql,
    explanation:
      parsed.explanation ?? 'Queried the commercial intelligence marts.',
    answerSummary: (summaryGen.text ?? '').trim(),
    columns: queryResult.columns,
    rows: queryResult.rows,
    rowCount: queryResult.rowCount,
    executionMs: queryResult.executionMs,
  };
}
