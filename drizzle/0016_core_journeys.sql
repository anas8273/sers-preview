CREATE TABLE `academic_terms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`academicYearId` int NOT NULL,
	`label` varchar(100) NOT NULL,
	`ordinal` int NOT NULL,
	`startsOn` varchar(10) NOT NULL,
	`endsOn` varchar(10) NOT NULL,
	CONSTRAINT `academic_terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_term_year_ordinal_unique` UNIQUE(`academicYearId`,`ordinal`)
);
--> statement-breakpoint
CREATE TABLE `academic_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scopeKey` varchar(64) NOT NULL,
	`ownerUserId` int,
	`organizationId` int,
	`label` varchar(100) NOT NULL,
	`startsOn` varchar(10) NOT NULL,
	`endsOn` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `academic_years_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_year_scope_label_unique` UNIQUE(`scopeKey`,`label`),
	CONSTRAINT `academic_year_owner_check` CHECK((
    (`academic_years`.`ownerUserId` IS NOT NULL AND `academic_years`.`organizationId` IS NULL)
    OR (`academic_years`.`ownerUserId` IS NULL AND `academic_years`.`organizationId` IS NOT NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE `upload_events` (
	`intentId` varchar(36) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `upload_events_intentId` PRIMARY KEY(`intentId`)
);
--> statement-breakpoint
ALTER TABLE `outputs` MODIFY COLUMN `type` enum('pdf','link','qr','docx') NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` MODIFY COLUMN `state` enum('issued','cancelled','expired','receiving','quarantined','rejected','validating','ready') NOT NULL DEFAULT 'issued';--> statement-breakpoint
ALTER TABLE `memberships` ADD `invitationAccepted` boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Historical invitations must still require acceptance after this upgrade.
UPDATE `memberships` SET `invitationAccepted` = false WHERE `status` = 'invited';--> statement-breakpoint
ALTER TABLE `work_items` ADD `academicYearId` int;--> statement-breakpoint
ALTER TABLE `work_items` ADD `academicTermId` int;--> statement-breakpoint
ALTER TABLE `work_items` ADD `academicContext` json;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `assetId` int;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `scanPolicyVersion` varchar(128);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `scanEngineVersion` varchar(255);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `detectedMimeType` varchar(128);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `scanCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `validationAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `nextValidationAt` timestamp;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `legalHold` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `tombstonedAt` timestamp;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `cleanupState` enum('pending','deleting','complete','blocked') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `cleanupToken` varchar(36);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `cleanupLeaseUntil` timestamp;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `cleanupObjectVersion` varchar(1024);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `cleanupAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD `nextCleanupAt` timestamp;--> statement-breakpoint
ALTER TABLE `upload_quota_budgets` ADD `storedBytes` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD CONSTRAINT `upload_intent_object_key_unique` UNIQUE(`objectKey`);--> statement-breakpoint
ALTER TABLE `upload_intents` ADD CONSTRAINT `upload_intent_asset_unique` UNIQUE(`assetId`);--> statement-breakpoint
ALTER TABLE `academic_terms` ADD CONSTRAINT `academic_terms_academicYearId_academic_years_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `academic_years` ADD CONSTRAINT `academic_years_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `academic_years` ADD CONSTRAINT `academic_years_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `upload_events` ADD CONSTRAINT `upload_events_intentId_upload_intents_id_fk` FOREIGN KEY (`intentId`) REFERENCES `upload_intents`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_academicYearId_academic_years_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academic_years`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_academicTermId_academic_terms_id_fk` FOREIGN KEY (`academicTermId`) REFERENCES `academic_terms`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `upload_intents` ADD CONSTRAINT `upload_intents_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE restrict ON UPDATE no action;
