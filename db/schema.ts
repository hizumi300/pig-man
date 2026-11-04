import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), ownerKey: text('owner_key').notNull().unique(),
  state: text('state').notNull(), version: integer('version').notNull(),
  updatedAt: integer('updated_at').notNull(), expiresAt: integer('expires_at').notNull(),
}, table => [index('rooms_expiry_idx').on(table.expiresAt), index('rooms_updated_idx').on(table.updatedAt)]);
export const writeLimits = sqliteTable('write_limits', {
  actor: text('actor').primaryKey(), minute: integer('minute').notNull(), count: integer('count').notNull(),
});
export const guestSessions = sqliteTable('guest_sessions', {
 tokenHash:text('token_hash').primaryKey(), actor:text('actor').notNull().unique(), expiresAt:integer('expires_at').notNull(), accountKey:text('account_key'),
});
export const profiles = sqliteTable('profiles', { actor:text('actor').primaryKey(), nickname:text('nickname').notNull() });
export const presence = sqliteTable('presence', { id:text('id').primaryKey(), seen:integer('seen').notNull() });
export const results = sqliteTable('results', {
 id:text('id').primaryKey(), actor:text('actor').notNull(), matchId:text('match_id').notNull(), endedAt:integer('ended_at').notNull(), players:integer('players').notNull(), won:integer('won').notNull(), departed:integer('departed').notNull(), ranked:integer('ranked').notNull(), mode:text('mode').notNull(), nickname:text('nickname').notNull(),
},table=>[index('results_actor_idx').on(table.actor),index('results_date_idx').on(table.endedAt)]);
