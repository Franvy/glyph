CREATE TABLE `sections` (
	`name` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "sections_name_known" CHECK("sections"."name" IN ('profile', 'projects', 'skills', 'now', 'snapshots')),
	CONSTRAINT "sections_data_json" CHECK(json_valid("sections"."data"))
);
