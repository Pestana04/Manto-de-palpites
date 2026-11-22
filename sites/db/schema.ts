import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const participants=sqliteTable('participants',{
  id:text('id').primaryKey(), tokenHash:text('token_hash').notNull().unique(),
  name:text('name').notNull(), photo:text('photo').notNull(), createdAt:text('created_at').notNull()
});
export const fixtures=sqliteTable('fixtures',{
  id:integer('id').primaryKey(),kickoff:text('kickoff').notNull(),status:text('status').notNull(),
  home:text('home').notNull(),away:text('away').notNull(),homeGoals:integer('home_goals'),awayGoals:integer('away_goals'),
  leagueId:integer('league_id').notNull(),league:text('league').notNull(),season:integer('season').notNull(),round:text('round_name').notNull()
});
export const predictions=sqliteTable('predictions',{
  participantId:text('participant_id').notNull().references(()=>participants.id),
  fixtureId:integer('fixture_id').notNull().references(()=>fixtures.id),home:integer('home').notNull(),away:integer('away').notNull(),updatedAt:text('updated_at').notNull()
},t=>[primaryKey({columns:[t.participantId,t.fixtureId]})]);
export const cache=sqliteTable('cache',{key:text('cache_key').primaryKey(),payload:text('payload').notNull()});
