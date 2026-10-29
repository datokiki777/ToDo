import { parseNote, type Note } from '@/features/notes/model';
import { notesRepository, type ImportResult, type NotesRepository } from '@/features/notes/repository';

export const BACKUP_APP = 'todo';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  formatVersion: number;
  exportedAt: string;
  notes: Note[];
}

export type BackupErrorCode = 'invalid-json' | 'not-a-backup' | 'unsupported-version';

export class BackupError extends Error {
  constructor(public readonly code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
  }
}

export function buildBackup(notes: Note[], exportedAt: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    notes,
  };
}

export function parseBackup(text: string): { notes: Note[]; invalid: number } {
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

  const notes: Note[] = [];
  let invalid = 0;
  for (const raw of file.notes) {
    const note = parseNote(raw);
    if (note) notes.push(note);
    else invalid += 1;
  }
  return { notes, invalid };
}

export function backupFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `todo-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Save every note (including trashed ones) as a JSON file the person can keep anywhere. */
export async function downloadBackup(repo: NotesRepository = notesRepository): Promise<number> {
  const notes = await repo.getAll();
  const blob = new Blob([JSON.stringify(buildBackup(notes), null, 2)], {
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
  repo: NotesRepository = notesRepository,
): Promise<ImportResult & { invalid: number }> {
  const { notes, invalid } = parseBackup(text);
  const result = await repo.importMany(notes);
  return { ...result, invalid };
}
