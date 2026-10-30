CREATE TABLE `contribution_days` (
	`date` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	CONSTRAINT "contribution_days_date_iso" CHECK("contribution_days"."date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "contribution_days_count_non_negative" CHECK("contribution_days"."count" >= 0)
);
