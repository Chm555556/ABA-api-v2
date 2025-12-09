import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    // This migration updates the role column to support SCHEDULER role
    // The role validation is handled at the application level (User model)
    // This is a tracking migration for the schema change
    
    // MySQL: Modify column comment
    this.schema.raw(`
      ALTER TABLE users MODIFY COLUMN role VARCHAR(20) 
      COMMENT 'User role: ADMIN, CLINIC, BCBA, RBT, PARENT, SCHEDULER'
    `)
  }

  async down() {
    // Revert the comment
    this.schema.raw(`
      ALTER TABLE users MODIFY COLUMN role VARCHAR(20) 
      COMMENT 'User role: ADMIN, CLINIC, BCBA, RBT, PARENT'
    `)
  }
}