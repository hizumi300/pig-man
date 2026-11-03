import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), ownerKey: text('owner_key').notNull().unique(),
  state: text('state').notNull(), version: integer('version').notNull(),
  updatedAt: integer('updated_at').notNull(), expiresAt: integer('expires_at').notNull(),
}, table => [index('rooms_expiry_idx').on(table.expiresAt), index('rooms_updated_idx').on(table.updatedAt)]);
export const writeLimits = sqliteTable('write_limits', {
  actor: text('actor').primaryKey(), minute: integer('minute').notNull(), count: integer('count').notNull(),
});
