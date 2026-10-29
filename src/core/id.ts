/** Globally unique id. UUIDs keep records from different devices from colliding once sync exists. */
export const newId = (): string => crypto.randomUUID();
