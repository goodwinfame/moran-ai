CREATE TYPE "public"."arc_type" AS ENUM('positive', 'negative', 'flat', 'corruption');--> statement-breakpoint
CREATE TYPE "public"."brief_status" AS ENUM('draft', 'approved', 'used', 'outdated');--> statement-breakpoint
CREATE TYPE "public"."brief_type" AS ENUM('hard', 'soft', 'free');--> statement-breakpoint
CREATE TYPE "public"."chapter_status" AS ENUM('draft', 'reviewing', 'archived', 'dirty');--> statement-breakpoint
CREATE TYPE "public"."chapter_type" AS ENUM('daily', 'normal', 'emotional', 'action', 'climax');--> statement-breakpoint
CREATE TYPE "public"."character_role" AS ENUM('protagonist', 'antagonist', 'supporting', 'minor');--> statement-breakpoint
CREATE TYPE "public"."decision_level" AS ENUM('L1_decision', 'L2_agent', 'L3_system');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('brainstorm', 'review', 'health_report', 'guide', 'analysis');--> statement-breakpoint
CREATE TYPE "public"."faction_status" AS ENUM('active', 'weakened', 'destroyed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."glossary_category" AS ENUM('location', 'organization', 'power_system', 'title', 'object', 'concept', 'custom');--> statement-breakpoint
CREATE TYPE "public"."knowledge_category" AS ENUM('writing_craft', 'genre', 'style', 'reference');--> statement-breakpoint
CREATE TYPE "public"."lesson_severity" AS ENUM('critical', 'major', 'minor');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('pending', 'active', 'archived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lie_status" AS ENUM('established', 'challenged', 'cracking', 'shattered');--> statement-breakpoint
CREATE TYPE "public"."location_significance" AS ENUM('major', 'moderate', 'minor');--> statement-breakpoint
CREATE TYPE "public"."location_status" AS ENUM('active', 'destroyed', 'abandoned', 'occupied');--> statement-breakpoint
CREATE TYPE "public"."memory_category" AS ENUM('guidance', 'world', 'characters', 'consistency', 'summaries', 'outline');--> statement-breakpoint
CREATE TYPE "public"."memory_stability" AS ENUM('immutable', 'canon', 'evolving', 'ephemeral');--> statement-breakpoint
CREATE TYPE "public"."memory_tier" AS ENUM('hot', 'warm', 'cold');--> statement-breakpoint
CREATE TYPE "public"."plot_thread_status" AS ENUM('planted', 'developing', 'resolved', 'stale');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'intent', 'world', 'characters', 'style', 'outline', 'ready', 'active');--> statement-breakpoint
CREATE TYPE "public"."significance" AS ENUM('minor', 'moderate', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."style_source" AS ENUM('builtin', 'user', 'fork');--> statement-breakpoint
CREATE TYPE "public"."tension_phase" AS ENUM('rising', 'peak', 'falling', 'valley');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"genre" varchar(100),
	"sub_genre" varchar(100),
	"language" varchar(10) DEFAULT 'zh-CN',
	"target_word_count" integer DEFAULT 500000,
	"chapter_count" integer DEFAULT 200,
	"words_per_chapter" integer,
	"pov" varchar(50),
	"tense" varchar(20),
	"tone_description" text,
	"writing_strategy" varchar(50),
	"style_id" varchar(100),
	"status" "project_status" DEFAULT 'planning',
	"current_chapter" integer DEFAULT 0,
	"current_arc" integer DEFAULT 0,
	"total_word_count" integer DEFAULT 0,
	"user_id" text DEFAULT 'local',
	"current_session_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapter_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"arc_index" integer,
	"type" "brief_type",
	"hard_constraints" jsonb,
	"soft_guidance" jsonb,
	"free_zone" text[],
	"emotional_landmine" text,
	"scenes_sequel_structure" jsonb,
	"status" "brief_status" DEFAULT 'draft',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapter_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text,
	"word_count" integer,
	"writer_name" varchar(100),
	"reason" varchar(50),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"title" varchar(500),
	"content" text,
	"word_count" integer,
	"writer_style" varchar(100),
	"status" "chapter_status" DEFAULT 'draft',
	"current_version" integer DEFAULT 1,
	"archived_version" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "character_dna" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"ghost" text,
	"wound" text,
	"lie" text,
	"want" text,
	"need" text,
	"arc_type" "arc_type",
	"default_mode" text,
	"stress_response" text,
	"lie_defense" text,
	"tell" text,
	"b_story_character_id" uuid,
	"b_story_function" text,
	"abnormal_factor" real DEFAULT 0.5,
	"lie_pressure_sensitivity" real DEFAULT 0.5,
	"arc_progress" real DEFAULT 0,
	"lie_confrontation_count" integer DEFAULT 0,
	"last_lie_pressure_chapter" integer
);
--> statement-breakpoint
CREATE TABLE "character_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"location" varchar(255),
	"emotional_state" varchar(255),
	"known_information" text[],
	"changes" text[],
	"is_alive" boolean DEFAULT true,
	"death_chapter" integer,
	"power_level" varchar(100),
	"abilities" text[],
	"inventory" text[],
	"physical_condition" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"aliases" text[],
	"role" character_role,
	"description" text,
	"personality" text,
	"background" text,
	"goals" text[],
	"first_appearance" integer,
	"arc" text,
	"profile_content" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "character_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "relationship_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"type" varchar(100),
	"intensity" real,
	"description" text,
	"change" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "world_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"section" varchar(100) NOT NULL,
	"name" varchar(255),
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "world_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"in_story_date" varchar(100),
	"season" varchar(50),
	"weather" varchar(100),
	"time_of_day" varchar(50),
	"major_world_events" text,
	"environment_notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_location_id" uuid NOT NULL,
	"target_location_id" uuid NOT NULL,
	"type" varchar(50),
	"description" text,
	"bidirectional" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"aliases" text[],
	"type" varchar(100),
	"description" text,
	"sensory_details" text,
	"layout" text,
	"significance" "location_significance",
	"first_appearance" integer,
	"parent_id" uuid,
	"status" "location_status" DEFAULT 'active',
	"related_character_ids" uuid[],
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "faction_status" DEFAULT 'active',
	"leader_id" uuid,
	"key_member_ids" uuid[],
	"territory" text,
	"changes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "glossary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"term" varchar(255) NOT NULL,
	"aliases" text[],
	"category" "glossary_category",
	"definition" text,
	"first_appearance" integer,
	"constraints" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "arcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"arc_index" integer NOT NULL,
	"title" varchar(500),
	"description" text,
	"start_chapter" integer,
	"end_chapter" integer,
	"detailed_plan" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"synopsis" text,
	"structure_type" varchar(50),
	"themes" text[],
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plot_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "plot_thread_status" DEFAULT 'planted',
	"introduced_chapter" integer,
	"resolved_chapter" integer,
	"related_character_ids" uuid[],
	"key_moments" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_number" integer,
	"story_timestamp" varchar(255),
	"description" text NOT NULL,
	"character_ids" uuid[],
	"location_id" uuid,
	"significance" "significance",
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_slices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category" "memory_category" NOT NULL,
	"tier" "memory_tier" DEFAULT 'warm',
	"scope" varchar(50),
	"stability" "memory_stability" DEFAULT 'evolving',
	"chapter_number" integer,
	"content" text,
	"char_count" integer,
	"token_count" integer,
	"importance" real,
	"priority_floor" integer DEFAULT 0,
	"freshness" real DEFAULT 1,
	"relevance_tags" text[],
	"source_agent" varchar(100),
	"source_chapter" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lie_confrontation_trackers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"lie_summary" text,
	"pressure_threshold" integer,
	"status" "lie_status" DEFAULT 'established'
);
--> statement-breakpoint
CREATE TABLE "tension_accumulators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"current_score" real DEFAULT 0,
	"peak_this_arc" real DEFAULT 0,
	"current_phase" "tension_phase" DEFAULT 'rising',
	"pending_events" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category" "document_category",
	"title" varchar(500),
	"content" text NOT NULL,
	"version" integer DEFAULT 1,
	"is_pinned" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(255) NOT NULL,
	"category" "knowledge_category",
	"title" varchar(500),
	"content" text NOT NULL,
	"tags" text[],
	"consumers" text[],
	"version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_entry_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"updated_by" varchar(100),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "decision_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"level" "decision_level",
	"agent_id" varchar(100),
	"action" varchar(255),
	"details" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "arc_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"arc_index" integer NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapter_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "style_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"style_id" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"genre" varchar(100),
	"description" text,
	"source" "style_source" DEFAULT 'user' NOT NULL,
	"forked_from" varchar(100),
	"version" integer DEFAULT 1,
	"modules" jsonb,
	"reviewer_focus" jsonb,
	"context_weights" jsonb,
	"tone" jsonb,
	"forbidden" jsonb,
	"encouraged" jsonb,
	"prose_guide" text,
	"examples" text,
	"is_active" boolean DEFAULT true,
	"user_id" text DEFAULT 'local',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "lesson_status" DEFAULT 'pending' NOT NULL,
	"severity" "lesson_severity" DEFAULT 'major' NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"source_chapter" integer,
	"source_agent" varchar(100),
	"issue_type" varchar(100),
	"tags" text[],
	"last_triggered_chapter" integer,
	"trigger_count" integer DEFAULT 0,
	"inactive_chapters" integer DEFAULT 0,
	"expiry_threshold" integer DEFAULT 20,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chapter_briefs" ADD CONSTRAINT "chapter_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_dna" ADD CONSTRAINT "character_dna_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_dna" ADD CONSTRAINT "character_dna_b_story_character_id_characters_id_fk" FOREIGN KEY ("b_story_character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_states" ADD CONSTRAINT "character_states_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_source_id_characters_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_target_id_characters_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_states" ADD CONSTRAINT "relationship_states_source_id_characters_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_states" ADD CONSTRAINT "relationship_states_target_id_characters_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_settings" ADD CONSTRAINT "world_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_states" ADD CONSTRAINT "world_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_connections" ADD CONSTRAINT "location_connections_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_connections" ADD CONSTRAINT "location_connections_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_leader_id_characters_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary_entries" ADD CONSTRAINT "glossary_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arcs" ADD CONSTRAINT "arcs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlines" ADD CONSTRAINT "outlines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_slices" ADD CONSTRAINT "memory_slices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lie_confrontation_trackers" ADD CONSTRAINT "lie_confrontation_trackers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lie_confrontation_trackers" ADD CONSTRAINT "lie_confrontation_trackers_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tension_accumulators" ADD CONSTRAINT "tension_accumulators_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_knowledge_entry_id_knowledge_entries_id_fk" FOREIGN KEY ("knowledge_entry_id") REFERENCES "public"."knowledge_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arc_summaries" ADD CONSTRAINT "arc_summaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_configs" ADD CONSTRAINT "style_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_briefs_project_chapter_unique" ON "chapter_briefs" USING btree ("project_id","chapter_number");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_versions_chapter_version_unique" ON "chapter_versions" USING btree ("chapter_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_project_chapter_unique" ON "chapters" USING btree ("project_id","chapter_number");--> statement-breakpoint
CREATE INDEX "chapters_project_id_idx" ON "chapters" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "chapters_project_chapter_idx" ON "chapters" USING btree ("project_id","chapter_number");--> statement-breakpoint
CREATE UNIQUE INDEX "character_dna_character_id_unique" ON "character_dna" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_states_character_chapter_unique" ON "character_states" USING btree ("character_id","chapter_number");--> statement-breakpoint
CREATE INDEX "characters_project_id_idx" ON "characters" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_relationships_source_target_type_unique" ON "character_relationships" USING btree ("source_id","target_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "world_settings_project_section_name_unique" ON "world_settings" USING btree ("project_id","section","name");--> statement-breakpoint
CREATE UNIQUE INDEX "world_states_project_chapter_unique" ON "world_states" USING btree ("project_id","chapter_number");--> statement-breakpoint
CREATE UNIQUE INDEX "location_connections_source_target_type_unique" ON "location_connections" USING btree ("source_location_id","target_location_id","type");--> statement-breakpoint
CREATE INDEX "locations_project_id_idx" ON "locations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "factions_project_id_idx" ON "factions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "glossary_entries_project_id_idx" ON "glossary_entries" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "arcs_project_arc_index_unique" ON "arcs" USING btree ("project_id","arc_index");--> statement-breakpoint
CREATE UNIQUE INDEX "outlines_project_id_unique" ON "outlines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "plot_threads_project_id_idx" ON "plot_threads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "timeline_events_project_id_idx" ON "timeline_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "memory_slices_project_id_idx" ON "memory_slices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "memory_slices_project_category_idx" ON "memory_slices" USING btree ("project_id","category");--> statement-breakpoint
CREATE INDEX "memory_slices_project_tier_idx" ON "memory_slices" USING btree ("project_id","tier");--> statement-breakpoint
CREATE UNIQUE INDEX "lie_confrontation_trackers_project_character_unique" ON "lie_confrontation_trackers" USING btree ("project_id","character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tension_accumulators_project_id_unique" ON "tension_accumulators" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_documents_project_id_idx" ON "project_documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_scope_idx" ON "knowledge_entries" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "decision_logs_project_id_idx" ON "decision_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "decision_logs_project_agent_idx" ON "decision_logs" USING btree ("project_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "arc_summaries_project_arc_unique" ON "arc_summaries" USING btree ("project_id","arc_index");--> statement-breakpoint
CREATE INDEX "arc_summaries_project_id_idx" ON "arc_summaries" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_summaries_project_chapter_unique" ON "chapter_summaries" USING btree ("project_id","chapter_number");--> statement-breakpoint
CREATE INDEX "chapter_summaries_project_id_idx" ON "chapter_summaries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "style_configs_project_id_idx" ON "style_configs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "style_configs_style_id_idx" ON "style_configs" USING btree ("style_id");--> statement-breakpoint
CREATE INDEX "lessons_project_id_idx" ON "lessons" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lessons_project_status_idx" ON "lessons" USING btree ("project_id","status");