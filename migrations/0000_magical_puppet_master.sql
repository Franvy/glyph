CREATE TABLE `likes` (
	`slug` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "likes_count_non_negative" CHECK("likes"."count" >= 0)
);
