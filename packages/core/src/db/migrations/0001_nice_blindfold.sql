CREATE TYPE "public"."knowledge_source" AS ENUM('builtin', 'user', 'fork');--> statement-breakpoint
ALTER TYPE "public"."character_role" ADD VALUE 'deuteragonist' BEFORE 'antagonist';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'brainstorm'::text;--> statement-breakpoint
DROP TYPE "public"."project_status";--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('brainstorm', 'world', 'character', 'outline', 'writing', 'completed');--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'brainstorm'::"public"."project_status";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE "public"."project_status" USING "status"::"public"."project_status";--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "wound" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "design_tier" text;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "source" "knowledge_source" DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "characters_project_name_unique" ON "characters" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_states_source_target_chapter_unique" ON "relationship_states" USING btree ("source_id","target_id","chapter_number");--> statement-breakpoint
CREATE UNIQUE INDEX "plot_threads_project_name_unique" ON "plot_threads" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_entries_scope_category_title_unique" ON "knowledge_entries" USING btree ("scope","category","title");--> statement-breakpoint
CREATE UNIQUE INDEX "style_configs_project_style_id_unique" ON "style_configs" USING btree ("project_id","style_id");