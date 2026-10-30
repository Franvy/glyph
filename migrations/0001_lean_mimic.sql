CREATE TABLE `counters` (
	`name` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "counters_name_known" CHECK("counters"."name" IN ('views', 'pets')),
	CONSTRAINT "counters_count_non_negative" CHECK("counters"."count" >= 0)
);
