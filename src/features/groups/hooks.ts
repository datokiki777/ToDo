import { useLiveQuery } from 'dexie-react-hooks';
import { groupsRepository } from './repository';

/** Live groups, oldest first. `undefined` while the first read is in flight. */
export function useGroups() {
  return useLiveQuery(() => groupsRepository.getAll(), []);
}
