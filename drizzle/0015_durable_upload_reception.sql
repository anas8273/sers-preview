ALTER TABLE `upload_intents` MODIFY COLUMN `state` enum('issued','cancelled','expired','receiving','quarantined','rejected') NOT NULL DEFAULT 'issued';--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `storageChargeHeld` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `objectKey` varchar(255);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `objectVersion` varchar(1024);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `sha256` varchar(64);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `actualBytes` int;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `leaseToken` varchar(36);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `leaseUntil` timestamp;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `nextAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `errorCode` varchar(64);--> statement-breakpoint
ALTER TABLE `upload_quota_budgets` ADD `retainedBytes` bigint DEFAULT 0 NOT NULL;