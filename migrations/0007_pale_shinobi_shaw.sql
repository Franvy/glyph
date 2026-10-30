CREATE TABLE `duolingo_profiles` (
	`username` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`streak` integer NOT NULL,
	`total_xp` integer NOT NULL,
	`learning` text,
	`fetched_at` integer NOT NULL,
	CONSTRAINT "duolingo_profiles_username_not_empty" CHECK(length("duolingo_profiles"."username") > 0),
	CONSTRAINT "duolingo_profiles_streak_non_negative" CHECK("duolingo_profiles"."streak" >= 0),
	CONSTRAINT "duolingo_profiles_total_xp_non_negative" CHECK("duolingo_profiles"."total_xp" >= 0)
);
