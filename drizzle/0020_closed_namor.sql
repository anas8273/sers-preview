ALTER TABLE `online_exam_responses` ADD `attemptId` varchar(128);--> statement-breakpoint
ALTER TABLE `online_exam_responses` ADD CONSTRAINT `online_exam_response_attempt_unique` UNIQUE(`onlineExamId`,`attemptId`);--> statement-breakpoint
CREATE INDEX `online_exam_response_exam_submitted_at_idx` ON `online_exam_responses` (`onlineExamId`,`submittedAt`,`id`);