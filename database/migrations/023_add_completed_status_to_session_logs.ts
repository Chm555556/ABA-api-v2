import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    // Add 'completed' to the status enum
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      MODIFY COLUMN status ENUM('draft', 'submitted', 'completed', 'bcba_approved', 'clinic_approved', 'approved', 'rejected') 
      DEFAULT 'draft'
    `)
  }

  async down() {
    // Remove 'completed' from the status enum
    this.schema.raw(`
      ALTER TABLE ${this.tableName} 
      MODIFY COLUMN status ENUM('draft', 'submitted', 'bcba_approved', 'clinic_approved', 'approved', 'rejected') 
      DEFAULT 'draft'
    `)
  }
}