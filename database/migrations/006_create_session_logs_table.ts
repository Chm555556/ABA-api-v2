import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE')
      table.integer('rbt_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('bcba_id').unsigned().notNullable().references('id').inTable('users')
      table.date('date').notNullable()
      table.time('start_time').notNullable()
      table.time('end_time').notNullable()
      table.integer('duration').notNullable() // in minutes
      table.decimal('total_hours', 4, 2).notNullable()
      table.string('cpt_code').notNullable()
      table.string('service_type').notNullable()
      table.enum('location', ['clinic', 'home', 'school', 'community']).notNullable()
      table.text('session_notes').nullable()
      table.string('rbt_signature').notNullable()
      table.string('parent_signature').nullable()
      table.enum('status', ['draft', 'submitted', 'bcba_approved', 'clinic_approved', 'approved', 'rejected']).defaultTo('draft')
      table.boolean('bcba_approved').defaultTo(false)
      table.integer('bcba_approved_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('bcba_approved_at').nullable()
      table.text('bcba_notes').nullable()
      table.boolean('clinic_approved').defaultTo(false)
      table.integer('clinic_approved_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('clinic_approved_at').nullable()
      table.text('clinic_notes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}