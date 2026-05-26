import { DB } from './storage.js';

export function renderCartoes() {
  return DB.cartoes;
}
