import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const catalogPlaces = sqliteTable("catalog_places", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  sourceId: text("source_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug"),
  description: text("description"),
  address: text("address"),
  subway: text("subway"),
  district: text("district"),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  categories: text("categories", { mode: "json" }).$type<string[]>().notNull().default([]),
  website: text("website"),
  imageUrl: text("image_url"),
  isClosed: integer("is_closed", { mode: "boolean" }).notNull().default(false),
  sourceUpdatedAt: text("source_updated_at"),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("catalog_places_source_id_uq").on(table.source, table.sourceId),
  index("catalog_places_geo_idx").on(table.lat, table.lon),
  index("catalog_places_district_idx").on(table.district),
]);

export const catalogEvents = sqliteTable("catalog_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  sourceId: text("source_id").notNull(),
  placeId: text("place_id").references(() => catalogPlaces.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  slug: text("slug"),
  description: text("description"),
  categories: text("categories", { mode: "json" }).$type<string[]>().notNull().default([]),
  priceText: text("price_text"),
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
  ageRestriction: text("age_restriction"),
  website: text("website"),
  imageUrl: text("image_url"),
  sourceUpdatedAt: text("source_updated_at"),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("catalog_events_source_id_uq").on(table.source, table.sourceId),
  index("catalog_events_place_idx").on(table.placeId),
]);

export const eventOccurrences = sqliteTable("event_occurrences", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => catalogEvents.id, { onDelete: "cascade" }),
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at"),
}, (table) => [
  index("event_occurrences_time_idx").on(table.startsAt, table.endsAt),
  index("event_occurrences_event_idx").on(table.eventId),
]);

export const catalogSyncState = sqliteTable("catalog_sync_state", {
  source: text("source").primaryKey(),
  status: text("status").notNull(),
  placesCount: integer("places_count").notNull().default(0),
  eventsCount: integer("events_count").notNull().default(0),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  error: text("error"),
});
