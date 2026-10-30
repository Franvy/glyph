PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sections` (
	`name` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "sections_name_known" CHECK("__new_sections"."name" IN ('profile', 'projects', 'skills', 'now', 'snapshots', 'banner')),
	CONSTRAINT "sections_data_json" CHECK(json_valid("__new_sections"."data"))
);
--> statement-breakpoint
INSERT INTO `__new_sections`("name", "data", "updated_at") SELECT "name", "data", "updated_at" FROM `sections`;--> statement-breakpoint
DROP TABLE `sections`;--> statement-breakpoint
ALTER TABLE `__new_sections` RENAME TO `sections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;