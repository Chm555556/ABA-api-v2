import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add clinic_id column if it doesn't exist
      table.integer('clinic_id').unsigned().nullable().references('id').inTable('clinics').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('clinic_id')
    })
  }
}
