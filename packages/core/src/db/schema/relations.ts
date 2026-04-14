import { relations } from "drizzle-orm";
import { chapterBriefs, chapters, chapterVersions } from "./chapters.js";
import { characterDna, characters, characterStates } from "./characters.js";
import { projectDocuments } from "./documents.js";
import { factions } from "./factions.js";
import { glossaryEntries } from "./glossary.js";
import { knowledgeEntries, knowledgeVersions } from "./knowledge.js";
import { locations, locationConnections } from "./locations.js";
import { decisionLogs } from "./logs.js";
import { memorySlices } from "./memory.js";
import { arcs, outlines, plotThreads, timelineEvents } from "./outline.js";
import { projects } from "./projects.js";
import { characterRelationships, relationshipStates } from "./relationships.js";
import { lieConfrontationTrackers, tensionAccumulators } from "./tension.js";
import { arcSummaries, chapterSummaries } from "./summaries.js";
import { worldSettings, worldStates } from "./world.js";

export const projectsRelations = relations(projects, ({ many }) => ({
  chapters: many(chapters),
  chapterBriefs: many(chapterBriefs),
  characters: many(characters),
  characterRelationships: many(characterRelationships),
  worldSettings: many(worldSettings),
  worldStates: many(worldStates),
  locations: many(locations),
  factions: many(factions),
  glossaryEntries: many(glossaryEntries),
  outlines: many(outlines),
  arcs: many(arcs),
  plotThreads: many(plotThreads),
  timelineEvents: many(timelineEvents),
  memorySlices: many(memorySlices),
  tensionAccumulators: many(tensionAccumulators),
  lieConfrontationTrackers: many(lieConfrontationTrackers),
  projectDocuments: many(projectDocuments),
  decisionLogs: many(decisionLogs),
  chapterSummaries: many(chapterSummaries),
  arcSummaries: many(arcSummaries),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  project: one(projects, {
    fields: [chapters.projectId],
    references: [projects.id],
  }),
  versions: many(chapterVersions),
}));

export const chapterVersionsRelations = relations(chapterVersions, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterVersions.chapterId],
    references: [chapters.id],
  }),
}));

export const chapterBriefsRelations = relations(chapterBriefs, ({ one }) => ({
  project: one(projects, {
    fields: [chapterBriefs.projectId],
    references: [projects.id],
  }),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  project: one(projects, {
    fields: [characters.projectId],
    references: [projects.id],
  }),
  states: many(characterStates),
  dna: many(characterDna, { relationName: "characterDnaMain" }),
  asBStoryFor: many(characterDna, { relationName: "characterDnaBStory" }),
  sourceRelationships: many(characterRelationships, { relationName: "relationshipSource" }),
  targetRelationships: many(characterRelationships, { relationName: "relationshipTarget" }),
  sourceRelationshipStates: many(relationshipStates, { relationName: "relationshipStateSource" }),
  targetRelationshipStates: many(relationshipStates, { relationName: "relationshipStateTarget" }),
  ledFactions: many(factions),
  lieConfrontationTrackers: many(lieConfrontationTrackers),
}));

export const characterStatesRelations = relations(characterStates, ({ one }) => ({
  character: one(characters, {
    fields: [characterStates.characterId],
    references: [characters.id],
  }),
}));

export const characterDnaRelations = relations(characterDna, ({ one }) => ({
  character: one(characters, {
    fields: [characterDna.characterId],
    references: [characters.id],
    relationName: "characterDnaMain",
  }),
  bStoryCharacter: one(characters, {
    fields: [characterDna.bStoryCharacterId],
    references: [characters.id],
    relationName: "characterDnaBStory",
  }),
}));

export const characterRelationshipsRelations = relations(characterRelationships, ({ one }) => ({
  project: one(projects, {
    fields: [characterRelationships.projectId],
    references: [projects.id],
  }),
  source: one(characters, {
    fields: [characterRelationships.sourceId],
    references: [characters.id],
    relationName: "relationshipSource",
  }),
  target: one(characters, {
    fields: [characterRelationships.targetId],
    references: [characters.id],
    relationName: "relationshipTarget",
  }),
}));

export const relationshipStatesRelations = relations(relationshipStates, ({ one }) => ({
  source: one(characters, {
    fields: [relationshipStates.sourceId],
    references: [characters.id],
    relationName: "relationshipStateSource",
  }),
  target: one(characters, {
    fields: [relationshipStates.targetId],
    references: [characters.id],
    relationName: "relationshipStateTarget",
  }),
}));

export const worldSettingsRelations = relations(worldSettings, ({ one }) => ({
  project: one(projects, {
    fields: [worldSettings.projectId],
    references: [projects.id],
  }),
}));

export const worldStatesRelations = relations(worldStates, ({ one }) => ({
  project: one(projects, {
    fields: [worldStates.projectId],
    references: [projects.id],
  }),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  project: one(projects, {
    fields: [locations.projectId],
    references: [projects.id],
  }),
  parent: one(locations, {
    fields: [locations.parentId],
    references: [locations.id],
    relationName: "locationHierarchy",
  }),
  children: many(locations, { relationName: "locationHierarchy" }),
  sourceConnections: many(locationConnections, { relationName: "connectionSource" }),
  targetConnections: many(locationConnections, { relationName: "connectionTarget" }),
  timelineEvents: many(timelineEvents),
}));

export const locationConnectionsRelations = relations(locationConnections, ({ one }) => ({
  sourceLocation: one(locations, {
    fields: [locationConnections.sourceLocationId],
    references: [locations.id],
    relationName: "connectionSource",
  }),
  targetLocation: one(locations, {
    fields: [locationConnections.targetLocationId],
    references: [locations.id],
    relationName: "connectionTarget",
  }),
}));

export const factionsRelations = relations(factions, ({ one }) => ({
  project: one(projects, {
    fields: [factions.projectId],
    references: [projects.id],
  }),
  leader: one(characters, {
    fields: [factions.leaderId],
    references: [characters.id],
  }),
}));

export const glossaryEntriesRelations = relations(glossaryEntries, ({ one }) => ({
  project: one(projects, {
    fields: [glossaryEntries.projectId],
    references: [projects.id],
  }),
}));

export const outlinesRelations = relations(outlines, ({ one }) => ({
  project: one(projects, {
    fields: [outlines.projectId],
    references: [projects.id],
  }),
}));

export const arcsRelations = relations(arcs, ({ one }) => ({
  project: one(projects, {
    fields: [arcs.projectId],
    references: [projects.id],
  }),
}));

export const plotThreadsRelations = relations(plotThreads, ({ one }) => ({
  project: one(projects, {
    fields: [plotThreads.projectId],
    references: [projects.id],
  }),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  project: one(projects, {
    fields: [timelineEvents.projectId],
    references: [projects.id],
  }),
  location: one(locations, {
    fields: [timelineEvents.locationId],
    references: [locations.id],
  }),
}));

export const memorySlicesRelations = relations(memorySlices, ({ one }) => ({
  project: one(projects, {
    fields: [memorySlices.projectId],
    references: [projects.id],
  }),
}));

export const tensionAccumulatorsRelations = relations(tensionAccumulators, ({ one }) => ({
  project: one(projects, {
    fields: [tensionAccumulators.projectId],
    references: [projects.id],
  }),
}));

export const lieConfrontationTrackersRelations = relations(lieConfrontationTrackers, ({ one }) => ({
  project: one(projects, {
    fields: [lieConfrontationTrackers.projectId],
    references: [projects.id],
  }),
  character: one(characters, {
    fields: [lieConfrontationTrackers.characterId],
    references: [characters.id],
  }),
}));

export const projectDocumentsRelations = relations(projectDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [projectDocuments.projectId],
    references: [projects.id],
  }),
}));

export const knowledgeEntriesRelations = relations(knowledgeEntries, ({ many }) => ({
  versions: many(knowledgeVersions),
}));

export const knowledgeVersionsRelations = relations(knowledgeVersions, ({ one }) => ({
  knowledgeEntry: one(knowledgeEntries, {
    fields: [knowledgeVersions.knowledgeEntryId],
    references: [knowledgeEntries.id],
  }),
}));

export const decisionLogsRelations = relations(decisionLogs, ({ one }) => ({
  project: one(projects, {
    fields: [decisionLogs.projectId],
    references: [projects.id],
  }),
}));

export const chapterSummariesRelations = relations(chapterSummaries, ({ one }) => ({
  project: one(projects, {
    fields: [chapterSummaries.projectId],
    references: [projects.id],
  }),
}));

export const arcSummariesRelations = relations(arcSummaries, ({ one }) => ({
  project: one(projects, {
    fields: [arcSummaries.projectId],
    references: [projects.id],
  }),
}));
