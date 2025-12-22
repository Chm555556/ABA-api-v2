import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clients'

  async up() {
    // Update existing clients to link them to their parents based on email matching
    await this.db.raw(`
      UPDATE clients 
      SET parent_id = (
        SELECT users.id 
        FROM users 
        WHERE users.role = 'PARENT' 
        AND users.email = clients.email
        LIMIT 1
      )
      WHERE parent_id IS NULL 
      AND email IN (
        SELECT email 
        FROM users 
        WHERE role = 'PARENT'
      )
    `)
  }

  async down() {
    // Optionally, you could reset parent_id to null, but this might not be desired
    // await this.db.from(this.tableName).update({ parent_id: null })
  }
}