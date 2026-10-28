CREATE TABLE `upload_quota_budgets` (
	`scopeKey` varchar(64) NOT NULL,
	`limitBytes` bigint NOT NULL,
	`maxActiveIntents` int NOT NULL,
	`reservedBytes` bigint NOT NULL DEFAULT 0,
	`activeIntents` int NOT NULL DEFAULT 0,
	CONSTRAINT `upload_quota_budgets_scopeKey` PRIMARY KEY(`scopeKey`)
);
--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `ownerType` enum('personal','organization') DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `workId` int;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `scopeKey` varchar(64);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `reservationHeld` boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Previous foundation never performed storage I/O. Expire unreserved live
-- intents rather than granting storage access without a quota reservation.
UPDATE `upload_intents` SET `scopeKey` = CONCAT('personal:', `actorUserId`);--> statement-breakpoint
UPDATE `upload_intents` SET `state` = 'expired', `revision` = `revision` + 1 WHERE `state` = 'issued';--> statement-breakpoint
ALTER TABLE `upload_intents` MODIFY `scopeKey` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD CONSTRAINT `upload_intent_actor_scope_key_unique` UNIQUE(`actorUserId`,`scopeKey`,`idempotencyKeyHash`);--> statement-breakpoint
-- Keep an actor-leading index available for the existing actor foreign key.
ALTER TABLE `upload_intents` DROP INDEX `upload_intent_actor_key_unique`;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD CONSTRAINT `upload_intents_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD CONSTRAINT `upload_intents_workId_work_items_id_fk` FOREIGN KEY (`workId`) REFERENCES `work_items`(`id`) ON DELETE restrict ON UPDATE no action;
