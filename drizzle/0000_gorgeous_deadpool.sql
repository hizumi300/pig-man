CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`state` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_owner_key_unique` ON `rooms` (`owner_key`);--> statement-breakpoint
CREATE INDEX `rooms_expiry_idx` ON `rooms` (`expires_at`);--> statement-breakpoint
CREATE INDEX `rooms_updated_idx` ON `rooms` (`updated_at`);--> statement-breakpoint
CREATE TABLE `write_limits` (
	`actor` text PRIMARY KEY NOT NULL,
	`minute` integer NOT NULL,
	`count` integer NOT NULL
);
