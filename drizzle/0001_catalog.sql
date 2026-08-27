PRAGMA foreign_keys = ON;

CREATE TABLE `catalog_places` (
  `id` text PRIMARY KEY NOT NULL,
  `source` text NOT NULL,
  `source_id` text NOT NULL,
  `name` text NOT NULL,
  `slug` text,
  `description` text,
  `address` text,
  `subway` text,
  `district` text,
  `lat` real NOT NULL,
  `lon` real NOT NULL,
  `categories` text DEFAULT '[]' NOT NULL,
  `website` text,
  `image_url` text,
  `is_closed` integer DEFAULT false NOT NULL,
  `source_updated_at` text,
  `synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `catalog_places_source_id_uq` ON `catalog_places` (`source`,`source_id`);
CREATE INDEX `catalog_places_geo_idx` ON `catalog_places` (`lat`,`lon`);
CREATE INDEX `catalog_places_district_idx` ON `catalog_places` (`district`);

CREATE TABLE `catalog_events` (
  `id` text PRIMARY KEY NOT NULL,
  `source` text NOT NULL,
  `source_id` text NOT NULL,
  `place_id` text,
  `title` text NOT NULL,
  `slug` text,
  `description` text,
  `categories` text DEFAULT '[]' NOT NULL,
  `price_text` text,
  `is_free` integer DEFAULT false NOT NULL,
  `age_restriction` text,
  `website` text,
  `image_url` text,
  `source_updated_at` text,
  `synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`place_id`) REFERENCES `catalog_places`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `catalog_events_source_id_uq` ON `catalog_events` (`source`,`source_id`);
CREATE INDEX `catalog_events_place_idx` ON `catalog_events` (`place_id`);

CREATE TABLE `event_occurrences` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `starts_at` integer NOT NULL,
  `ends_at` integer,
  FOREIGN KEY (`event_id`) REFERENCES `catalog_events`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `event_occurrences_time_idx` ON `event_occurrences` (`starts_at`,`ends_at`);
CREATE INDEX `event_occurrences_event_idx` ON `event_occurrences` (`event_id`);

CREATE TABLE `catalog_sync_state` (
  `source` text PRIMARY KEY NOT NULL,
  `status` text NOT NULL,
  `places_count` integer DEFAULT 0 NOT NULL,
  `events_count` integer DEFAULT 0 NOT NULL,
  `synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `error` text
);
