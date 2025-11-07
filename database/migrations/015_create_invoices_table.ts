import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients')
      table.integer('rbt_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('bcba_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('clinic_id').unsigned().notNullable().references('id').inTable('clinics')
      table.json('session_ids').notNullable()
      table.date('period_start').notNullable()
      table.date('period_end').notNullable()
      table.integer('session_count').notNullable()
      table.decimal('total_hours', 6, 2).notNullable()
      table.decimal('amount', 10, 2).notNullable()
      table.enum('status', ['draft', 'submitted', 'paid', 'rejected']).defaultTo('draft')
      table.timestamp('submitted_at').nullable()
      table.timestamp('paid_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}