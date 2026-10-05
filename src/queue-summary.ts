export type TaskStatus =
  | 'queued'
  | 'running'
  | 'needs_attention'
  | 'needs_review'
  | 'tests_passed';

export interface TaskRecord {
  readonly id: string;
  readonly status: string;
}

export interface QueueSummary {
  total: number;
  counts: Record<TaskStatus, number>;
  needsActionIds: string[];
}

const SUPPORTED_STATUSES: ReadonlySet<string> = new Set<TaskStatus>([
  'queued',
  'running',
  'needs_attention',
  'needs_review',
  'tests_passed',
]);

export function summarizeTasks(tasks: readonly TaskRecord[]): QueueSummary {
  const counts: Record<TaskStatus, number> = {
    queued: 0,
    running: 0,
    needs_attention: 0,
    needs_review: 0,
    tests_passed: 0,
  };

  const needsActionIds: string[] = [];
  const seenIds = new Set<string>();

  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || task.id.trim() === '') {
      throw new Error(`Blank or invalid task ID: ${task ? task.id : 'undefined'}`);
    }

    if (seenIds.has(task.id)) {
      throw new Error(`Duplicate task ID: ${task.id}`);
    }
    seenIds.add(task.id);

    if (!SUPPORTED_STATUSES.has(task.status)) {
      throw new Error(`Unknown or unsupported task status: ${task.status}`);
    }

    const status = task.status as TaskStatus;
    counts[status] += 1;

    if (status === 'needs_attention' || status === 'needs_review') {
      needsActionIds.push(task.id);
    }
  }

  return {
    total: tasks.length,
    counts,
    needsActionIds,
  };
}
