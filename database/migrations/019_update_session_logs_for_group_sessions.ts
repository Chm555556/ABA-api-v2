import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Update session_logs table for group sessions
 * 
 * Changes:
 * 1. Add session_type column (one_to_one, group, community)
 * 2. Make client_id nullable (for group sessions, clients are in session_participants)
 * 3. Make parent_signature nullable (moved to session_participants for group sessions)
 */
export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add session type
      table
        .enum('session_type', ['one_to_one', 'group', 'community'])
        .defaultTo('one_to_one')
        .notNullable()
        .after('location')
      
      // Make client_id nullable for group sessions
      table.integer('client_id').unsigned().nullable().alter()
      
      // Add index for better query performance
      table.index(['rbt_id', 'date', 'start_time'])
      table.index(['session_type'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('session_type')
      table.dropIndex(['rbt_id', 'date', 'start_time'])
      table.dropIndex(['session_type'])
      
      // Restore client_id to not nullable
      table.integer('client_id').unsigned().notNullable().alter()
    })
  }
}
