import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Create session_participants table
 * 
 * This table stores multiple clients for group/community sessions.
 * 
 * Why we need this:
 * - Old system: session_logs.client_id (only 1 client per session)
 * - New system: session_participants (many clients per session)
 * 
 * For backward compatibility:
 * - One-to-one sessions still use session_logs.client_id
 * - Group/Community sessions use this table
 */
export default class extends BaseSchema {
  protected tableName = 'session_participants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      // Link to the session
      table
        .integer('session_log_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('session_logs')
        .onDelete('CASCADE')
      
      // Link to the client (child)
      table
        .integer('client_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clients')
        .onDelete('CASCADE')
      
      // Each participant can have their own parent signature
      table.string('parent_signature').nullable()
      
      // Notes specific to this participant in the session
      table.text('notes').nullable()
      
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      
      // Prevent duplicate entries (same client can't be in same session twice)
      table.unique(['session_log_id', 'client_id'])
      
      // Index for faster queries
      table.index(['session_log_id'])
      table.index(['client_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
