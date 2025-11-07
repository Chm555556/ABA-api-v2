import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'behavior_data'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('session_id').unsigned().notNullable().references('id').inTable('session_logs').onDelete('CASCADE')
      table.integer('goal_id').unsigned().notNullable().references('id').inTable('treatment_goals')
      table.integer('correct').defaultTo(0)
      table.integer('incorrect').defaultTo(0)
      table.integer('prompted').defaultTo(0)
      table.integer('total').defaultTo(0)
      table.decimal('percentage', 5, 2).defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}