/**
 * Browser assets must never contain SQL statements. Pairing each verb with a clause
 * keyword keeps the guard about SQL syntax instead of ordinary English words.
 */
export const BROWSER_SQL_SYNTAX = /\b(?:SELECT\b[^\r\n;]{0,120}\bFROM\b|INSERT\b[^\r\n;]{0,80}\bINTO\b|UPDATE\b[^\r\n;]{0,120}\b(?:SET|WHERE)\b|DELETE\b[^\r\n;]{0,80}\b(?:FROM|WHERE)\b)/i;
