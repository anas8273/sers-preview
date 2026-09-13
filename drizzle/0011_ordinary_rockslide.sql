CREATE TABLE `asset_standard_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`standardVersionId` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_standard_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `asset_standard_unique` UNIQUE(`assetId`,`standardVersionId`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorUserId` int NOT NULL,
	`ownerType` enum('personal','organization') NOT NULL DEFAULT 'personal',
	`ownerUserId` int,
	`ownerOrganizationId` int,
	`kind` enum('file','link','text') NOT NULL,
	`title` varchar(255) NOT NULL,
	`storageKey` varchar(512),
	`externalUrl` text,
	`mimeType` varchar(128),
	`fileSize` int,
	`metadata` json,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_owner_check` CHECK((
    (`assets`.`ownerType` = 'personal' AND `assets`.`ownerUserId` IS NOT NULL AND `assets`.`ownerOrganizationId` IS NULL)
    OR
    (`assets`.`ownerType` = 'organization' AND `assets`.`ownerOrganizationId` IS NOT NULL AND `assets`.`ownerUserId` IS NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE `content_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workItemId` int NOT NULL,
	`blockType` varchar(64) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`data` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`organizationId` int,
	`productId` int NOT NULL,
	`purchaseId` int,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `entitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `entitlement_user_product_unique` UNIQUE(`userId`,`productId`),
	CONSTRAINT `entitlement_org_product_unique` UNIQUE(`organizationId`,`productId`),
	CONSTRAINT `entitlements_owner_check` CHECK((
    (`entitlements`.`userId` IS NOT NULL AND `entitlements`.`organizationId` IS NULL)
    OR
    (`entitlements`.`userId` IS NULL AND `entitlements`.`organizationId` IS NOT NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','reviewer','member') NOT NULL DEFAULT 'member',
	`status` enum('invited','active','suspended','left') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`leftAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_org_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`dedupeKey` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`targetType` varchar(64),
	`targetId` varchar(128),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_user_dedupe_unique` UNIQUE(`userId`,`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`settings` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workVersionId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`type` enum('pdf','link','qr') NOT NULL,
	`visibility` enum('private','protected','public') NOT NULL DEFAULT 'private',
	`token` varchar(128),
	`passwordHash` varchar(256),
	`storageKey` varchar(512),
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outputs_id` PRIMARY KEY(`id`),
	CONSTRAINT `outputs_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`productType` enum('template','package') NOT NULL,
	`templateId` int,
	`priceMinor` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`compatibility` json,
	`licenseKey` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`state` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`amountMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`provider` varchar(64),
	`providerPaymentRef` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchases_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `review_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`userId` int NOT NULL,
	`anchor` json,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workVersionId` int NOT NULL,
	`requestedByUserId` int NOT NULL,
	`reviewerUserId` int NOT NULL,
	`status` enum('pending','changes_requested','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`decisionNote` text,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_version_reviewer_unique` UNIQUE(`workVersionId`,`reviewerUserId`)
);
--> statement-breakpoint
CREATE TABLE `standard_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`standardKey` varchar(128) NOT NULL,
	`version` varchar(64) NOT NULL,
	`title` varchar(512) NOT NULL,
	`data` json,
	`effectiveFrom` timestamp,
	`effectiveTo` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `standard_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `standard_version_unique` UNIQUE(`standardKey`,`version`)
);
--> statement-breakpoint
CREATE TABLE `work_asset_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workItemId` int NOT NULL,
	`assetId` int NOT NULL,
	`role` varchar(64) NOT NULL DEFAULT 'evidence',
	`caption` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `work_asset_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_asset_unique` UNIQUE(`workItemId`,`assetId`,`role`)
);
--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorUserId` int NOT NULL,
	`ownerType` enum('personal','organization') NOT NULL DEFAULT 'personal',
	`ownerUserId` int,
	`ownerOrganizationId` int,
	`type` enum('report','portfolio') NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('draft','in_review','approved','archived') NOT NULL DEFAULT 'draft',
	`currentVersionNumber` int NOT NULL DEFAULT 0,
	`metadata` json,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_items_owner_check` CHECK((
    (`work_items`.`ownerType` = 'personal' AND `work_items`.`ownerUserId` IS NOT NULL AND `work_items`.`ownerOrganizationId` IS NULL)
    OR
    (`work_items`.`ownerType` = 'organization' AND `work_items`.`ownerOrganizationId` IS NOT NULL AND `work_items`.`ownerUserId` IS NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE `work_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workItemId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`reason` varchar(255),
	`snapshot` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `work_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_version_unique` UNIQUE(`workItemId`,`versionNumber`)
);
--> statement-breakpoint
ALTER TABLE `asset_standard_links` ADD CONSTRAINT `asset_standard_links_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `asset_standard_links` ADD CONSTRAINT `asset_standard_links_standardVersionId_standard_versions_id_fk` FOREIGN KEY (`standardVersionId`) REFERENCES `standard_versions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_creatorUserId_users_id_fk` FOREIGN KEY (`creatorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_ownerOrganizationId_organizations_id_fk` FOREIGN KEY (`ownerOrganizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_blocks` ADD CONSTRAINT `content_blocks_workItemId_work_items_id_fk` FOREIGN KEY (`workItemId`) REFERENCES `work_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_purchaseId_purchases_id_fk` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outputs` ADD CONSTRAINT `outputs_workVersionId_work_versions_id_fk` FOREIGN KEY (`workVersionId`) REFERENCES `work_versions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outputs` ADD CONSTRAINT `outputs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_templateId_pdf_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `pdf_templates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_comments` ADD CONSTRAINT `review_comments_reviewId_reviews_id_fk` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_comments` ADD CONSTRAINT `review_comments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_workVersionId_work_versions_id_fk` FOREIGN KEY (`workVersionId`) REFERENCES `work_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewerUserId_users_id_fk` FOREIGN KEY (`reviewerUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_asset_links` ADD CONSTRAINT `work_asset_links_workItemId_work_items_id_fk` FOREIGN KEY (`workItemId`) REFERENCES `work_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_asset_links` ADD CONSTRAINT `work_asset_links_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_creatorUserId_users_id_fk` FOREIGN KEY (`creatorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_items` ADD CONSTRAINT `work_items_ownerOrganizationId_organizations_id_fk` FOREIGN KEY (`ownerOrganizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_versions` ADD CONSTRAINT `work_versions_workItemId_work_items_id_fk` FOREIGN KEY (`workItemId`) REFERENCES `work_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_versions` ADD CONSTRAINT `work_versions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;