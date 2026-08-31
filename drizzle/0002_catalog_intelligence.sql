ALTER TABLE `catalog_places` ADD `city` text DEFAULT 'spb' NOT NULL;
ALTER TABLE `catalog_places` ADD `traits` text DEFAULT '[]' NOT NULL;
ALTER TABLE `catalog_places` ADD `canonical_key` text DEFAULT '' NOT NULL;
ALTER TABLE `catalog_places` ADD `popularity` integer DEFAULT 0 NOT NULL;
ALTER TABLE `catalog_places` ADD `quality_score` real DEFAULT 0 NOT NULL;

UPDATE `catalog_places`
SET `city` = 'moscow'
WHERE `lat` BETWEEN 55.45 AND 56.05 AND `lon` BETWEEN 36.75 AND 38.15;

CREATE INDEX `catalog_places_city_geo_idx` ON `catalog_places` (`city`,`lat`,`lon`);
CREATE INDEX `catalog_places_city_quality_idx` ON `catalog_places` (`city`,`quality_score`);
CREATE INDEX `catalog_places_canonical_idx` ON `catalog_places` (`canonical_key`);
