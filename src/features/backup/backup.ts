import { parseGroup, type Group } from '@/features/groups/model';
import { groupsRepository, type GroupsRepository } from '@/features/groups/repository';
import { parseNote, type Note } from '@/features/notes/model';
import { notesRepository, type ImportResult, type NotesRepository } from '@/features/notes/repository';

export const BACKUP_APP = 'todo';
/** 1 = notes only. 2 = notes and groups. Older files stay readable. */
export const BACKUP_FORMAT_VERSION = 2;

export interface BackupFile {
  app: typeof BACKUP_APP;
  formatVersion: number;
  exportedAt: string;
  groups: Group[];
  notes: Note[];
}

export type BackupErrorCode = 'invalid-json' | 'not-a-backup' | 'unsupported-version';

export class BackupError extends Error {
  constructor(public readonly code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
  }
}

export interface BackupRepos {
  notes: NotesRepository;
  groups: GroupsRepository;
}

const defaultRepos = (): BackupRepos => ({ notes: notesRepository, groups: groupsRepository });

export function buildBackup(notes: Note[], groups: Group[], exportedAt: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    groups,
    notes,
  };
}

export function parseBackup(text: string): { notes: Note[]; groups: Group[]; invalid: number } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('invalid-json');
  }
  if (typeof data !== 'object' || data === null) throw new BackupError('not-a-backup');
  const file = data as Record<string, unknown>;
  if (file.app !== BACKUP_APP || !Array.isArray(file.notes)) throw new BackupError('not-a-backup');
  if (typeof file.formatVersion !== 'number' || file.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError('unsupported-version');
  }

  let invalid = 0;
  const notes: Note[] = [];
  for (const raw of file.notes) {
    const note = parseNote(raw);
    if (note) notes.push(note);
    else invalid += 1;
  }
  const groups: Group[] = [];
  // Version 1 files have no groups at all.
  for (const raw of Array.isArray(file.groups) ? file.groups : []) {
    const group = parseGroup(raw);
    if (group) groups.push(group);
    else invalid += 1;
  }
  return { notes, groups, invalid };
}

export function backupFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `todo-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Save every note and group (including trashed ones) as a JSON file the person can keep anywhere. */
export async function downloadBackup(repos: BackupRepos = defaultRepos()): Promise<number> {
  const [notes, groups] = await Promise.all([repos.notes.getAll(), repos.groups.getAllIncludingDeleted()]);
  const blob = new Blob([JSON.stringify(buildBackup(notes, groups), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return notes.length;
}

export async function restoreBackup(
  text: string,
  repos: BackupRepos = defaultRepos(),
): Promise<ImportResult & { invalid: number }> {
  const { notes, groups, invalid } = parseBackup(text);
  await repos.groups.importMany(groups);
  const result = await repos.notes.importMany(notes);
  return { ...result, invalid };
}
