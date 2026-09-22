import { v7 as uuidv7 } from "uuid";

/**
 * UUID v7 everywhere: time-ordered, so rows sort by creation without a second
 * column and index locality stays sane as the closet grows.
 * Postgres 17 has no built-in uuidv7(), so it is generated here.
 */
export function newId(): string {
  return uuidv7();
}
