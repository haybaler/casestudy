import { useState } from 'react';
import { Play, Download, ArrowRight, RotateCcw } from 'lucide-react';
import type { TextToSqlResult } from '../types';
import { formatCellValue, formatNumber } from '../utils/format';

const SAMPLE_PROMPTS = [
  'How much catalog revenue came from biopharma in Q3?',
  'Which 10 Biopharma or CDMO accounts have gone quiet with the highest historical spend?',
  'Compare first-touch vs last-touch ROAS across all lead sources for 2026.',
  'What is the quarterly revenue breakdown by product line for Custom orders?',
];

export function WarehouseQaView() {
  const [question, setQuestion] = useState(SAMPLE_PROMPTS[0]);
  const [loading, setLoading] = useState(false);
  const [runningSql, setRunningSql] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TextToSqlResult | null>(null);
  const [editableSql, setEditableSql] = useState('');
  const [history, setHistory] = useState<TextToSqlResult[]>([]);

  async function submitQuestion(promptText: string) {
    const q = promptText.trim();
    if (!q) return;
    setQuestion(q);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to translate and execute query.');
      }
      const typed = data as TextToSqlResult;
      setResult(typed);
      setEditableSql(typed.sql);
      setHistory((prev) => [typed, ...prev.filter((item) => item.question !== typed.question)].slice(0, 6));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runEditedSql() {
    if (!editableSql.trim()) return;
    setRunningSql(true);
    setError(null);
    try {
      const res = await fetch('/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: editableSql }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'SQL execution failed.');
      }
      setResult((prev) => ({
        question: prev?.question ?? 'Custom SQL Query',
        sql: data.sql,
        explanation: 'Executed user-edited read-only SQL directly against the SQLite warehouse.',
        answerSummary: `Returned ${data.rowCount} row${data.rowCount === 1 ? '' : 's'} in ${data.executionMs} ms.`,
        columns: data.columns,
        rows: data.rows,
        rowCount: data.rowCount,
        executionMs: data.executionMs,
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningSql(false);
    }
  }

  function downloadCsv() {
    if (!result || result.columns.length === 0) return;
    const escape = (val: unknown) => {
      const s = val === null || val === undefined ? '' : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [
      result.columns.map(escape).join(','),
      ...result.rows.map((row) => result.columns.map((c) => escape(row[c])).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'warehouse_query_results.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Prompt Composer */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Plain-English Warehouse Q&amp;A (Text-to-SQL)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Translates executive questions into read-only SQLite queries against <span className="font-mono">mart_order_attribution</span>, <span className="font-mono">mart_account_health</span>, and <span className="font-mono">mart_attribution_comparison</span>.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Read-Only Guard · SELECT / WITH
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(question);
          }}
          className="mt-4 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a commercial question (e.g., how much catalog revenue came from biopharma in Q3?)"
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <span>{loading ? 'Querying Warehouse...' : 'Run Warehouse Query'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Sample Executive Prompts */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 mr-1">Example asks:</span>
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => submitQuestion(sample)}
              disabled={loading}
              className="px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded border border-slate-200/70 transition-colors text-left"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-white border border-rose-200 rounded-lg p-5 text-xs text-rose-700">
          <span className="font-semibold">Query Error:</span> {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-white border border-slate-200 rounded-lg" />
          <div className="h-44 bg-white border border-slate-200 rounded-lg" />
          <div className="h-64 bg-white border border-slate-200 rounded-lg" />
        </div>
      )}

      {/* Results View */}
      {!loading && result && (
        <div className="space-y-6">
          {/* Executive Synthesis */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 mb-2">
              <span>Warehouse Synthesis</span>
              <span>
                {formatNumber(result.rowCount)} rows · {result.executionMs} ms execution
              </span>
            </div>
            <p className="text-sm text-slate-900 leading-relaxed">{result.answerSummary}</p>
            <p className="mt-2 text-xs text-slate-500">{result.explanation}</p>
          </div>

          {/* Inspectable & Editable SQL Panel */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-700">
                Generated Warehouse SQL (Editable)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditableSql(result.sql)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={runEditedSql}
                  disabled={runningSql}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="w-3 h-3" />
                  {runningSql ? 'Running...' : 'Run Edited SQL'}
                </button>
              </div>
            </div>
            <textarea
              value={editableSql}
              onChange={(e) => setEditableSql(e.target.value)}
              rows={Math.min(12, Math.max(4, editableSql.split('\n').length + 1))}
              spellCheck={false}
              className="w-full p-4 font-mono text-xs text-slate-800 bg-white focus:outline-none resize-y leading-relaxed"
            />
          </div>

          {/* Result Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="text-xs font-semibold text-slate-900">
                Query Result Set ({formatNumber(result.rowCount)} rows)
              </div>
              {result.rows.length > 0 && (
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </button>
              )}
            </div>

            {result.rows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Query succeeded with 0 matching rows.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr className="text-[11px] font-semibold text-slate-600">
                      {result.columns.map((col) => (
                        <th key={col} className="py-2.5 px-4 font-mono whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/80">
                        {result.columns.map((col) => {
                          const val = row[col];
                          const isNumeric = typeof val === 'number';
                          return (
                            <td
                              key={col}
                              className={`py-2.5 px-4 whitespace-nowrap ${
                                isNumeric
                                  ? 'text-right font-mono tabular-nums text-slate-900'
                                  : 'text-slate-700'
                              }`}
                            >
                              {formatCellValue(col, val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Queries */}
      {history.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-semibold text-slate-700 mb-3">
            Session Query History
          </div>
          <div className="divide-y divide-slate-100">
            {history.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuestion(item.question);
                  setResult(item);
                  setEditableSql(item.sql);
                }}
                className="w-full py-2.5 text-left flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded transition-colors"
              >
                <span className="text-xs text-slate-800 truncate">{item.question}</span>
                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">
                  {item.rowCount} rows · {item.executionMs}ms
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
