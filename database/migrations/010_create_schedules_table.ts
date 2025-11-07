import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'schedules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE')
      table.integer('rbt_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('bcba_id').unsigned().notNullable().references('id').inTable('users')
      table.date('date').notNullable()
      table.time('start_time').notNullable()
      table.time('end_time').notNullable()
      table.enum('location', ['clinic', 'home', 'school', 'community']).notNullable()
      table.enum('status', ['scheduled', 'completed', 'cancelled', 'no_show']).defaultTo('scheduled')
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}