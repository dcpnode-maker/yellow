import type { GroupHeader, GroupPage } from "../group-reservations-api";

export type GroupSearchPageState = Readonly<{
  rows: readonly GroupHeader[];
  cursor: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  announcement: string;
}>;

export const GROUP_SEARCH_SESSION_ENDED_MESSAGE = "Your session ended. Sign in again to continue.";
export const GROUP_SEARCH_SESSION_RESTORED_MESSAGE = "Session restored. Search again to refresh group results.";

export function emptyGroupSearchPageState(loading = false): GroupSearchPageState {
  return { rows: [], cursor: null, loading, initialized: false, error: null, announcement: "" };
}

export function groupSearchSessionEndedPageState(): GroupSearchPageState {
  return { ...emptyGroupSearchPageState(), error: GROUP_SEARCH_SESSION_ENDED_MESSAGE };
}

export function groupSearchSessionRestoredPageState(): GroupSearchPageState {
  return { ...emptyGroupSearchPageState(), announcement: GROUP_SEARCH_SESSION_RESTORED_MESSAGE };
}

export function startGroupSearchPage(state: GroupSearchPageState): GroupSearchPageState {
  return { ...state, loading: true, error: null, announcement: "" };
}

export function succeedGroupSearchPage(state: GroupSearchPageState, result: GroupPage, initial: boolean, repeatedCursor: boolean): GroupSearchPageState {
  const rows = initial ? mergeGroupSearchPages([], result.groups) : mergeGroupSearchPages(state.rows, result.groups);
  return { rows, cursor: repeatedCursor ? null : result.nextCursor, loading: false, initialized: true,
    error: repeatedCursor ? "Pagination stopped because the server repeated a cursor." : null,
    announcement: initial ? `${rows.length} groups loaded.` : `${result.groups.filter((row) => !state.rows.some((loaded) => loaded.groupId === row.groupId)).length} more groups loaded.` };
}

export function failGroupSearchPage(state: GroupSearchPageState, message: string, initial: boolean, denied: boolean): GroupSearchPageState {
  return { ...state, rows: denied ? [] : state.rows, cursor: denied ? null : state.cursor, loading: false,
    initialized: denied || initial ? false : state.initialized, error: message, announcement: "Group results could not be loaded." };
}

/** Merge loaded pages in server order, keeping the first position and latest header. */
export function mergeGroupSearchPages(existing: readonly GroupHeader[], incoming: readonly GroupHeader[]): readonly GroupHeader[] {
  const merged = [...existing];
  const positions = new Map(merged.map((row, index) => [row.groupId, index]));
  for (const row of incoming) {
    const position = positions.get(row.groupId);
    if (position === undefined) { positions.set(row.groupId, merged.length); merged.push(row); }
    else merged[position] = row;
  }
  return merged;
}

export type GroupSearchPageTicket = Readonly<{ generation: number; query: string; cursor: string | null; key: string }>;

/** Synchronous owner for page requests; restarted searches revoke every older ticket. */
export class GroupSearchPageOwner {
  private currentGeneration = 0;
  private activeKey: string | null = null;
  private seenCursors = new Set<string | null>();

  restart(): number {
    this.currentGeneration += 1;
    this.activeKey = null;
    this.seenCursors = new Set([null]);
    return this.currentGeneration;
  }

  invalidate(): void { this.currentGeneration += 1; this.activeKey = null; }
  generation(): number { return this.currentGeneration; }

  begin(query: string, cursor: string | null, generation = this.currentGeneration): GroupSearchPageTicket | null {
    if (generation !== this.currentGeneration || this.activeKey !== null) return null;
    const key = `${generation}:${cursor ?? "<first>"}`;
    this.activeKey = key;
    return Object.freeze({ generation, query, cursor, key });
  }

  owns(ticket: GroupSearchPageTicket): boolean {
    return ticket.generation === this.currentGeneration && ticket.key === this.activeKey;
  }

  finish(ticket: GroupSearchPageTicket): void {
    if (this.activeKey === ticket.key) this.activeKey = null;
  }

  acceptNextCursor(cursor: string | null): boolean {
    if (cursor === null) return true;
    if (this.seenCursors.has(cursor)) return false;
    this.seenCursors.add(cursor);
    return true;
  }

}

/** Filters apply to every loaded page. Group membership is never inferred from stays. */
export function filterGroupSearchRows(rows: readonly GroupHeader[], status: string, kind: string): readonly GroupHeader[] {
  return rows.filter((row) => (!status || row.status === status) && (!kind || row.kind === kind));
}
