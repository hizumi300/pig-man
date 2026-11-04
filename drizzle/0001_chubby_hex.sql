CREATE TABLE `guest_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`expires_at` integer NOT NULL,
	`account_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_sessions_actor_unique` ON `guest_sessions` (`actor`);--> statement-breakpoint
CREATE TABLE `presence` (
	`id` text PRIMARY KEY NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`actor` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `results` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`match_id` text NOT NULL,
	`ended_at` integer NOT NULL,
	`players` integer NOT NULL,
	`won` integer NOT NULL,
	`departed` integer NOT NULL,
	`ranked` integer NOT NULL,
	`mode` text NOT NULL,
	`nickname` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `results_actor_idx` ON `results` (`actor`);--> statement-breakpoint
CREATE INDEX `results_date_idx` ON `results` (`ended_at`);