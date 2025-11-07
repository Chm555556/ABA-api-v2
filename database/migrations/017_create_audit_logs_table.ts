import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
      table.string('action').notNullable()
      table.string('entity_type').notNullable()
      table.integer('entity_id').notNullable()
      table.json('changes').nullable()
      table.string('ip_address').nullable()
      table.timestamp('timestamp').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}