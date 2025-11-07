import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('email').notNullable().unique()
      table.string('password').notNullable()
      table.enum('role', ['ADMIN', 'CLINIC', 'BCBA', 'RBT', 'PARENT']).notNullable()
      // table.integer('clinic_id').unsigned().nullable().references('id').inTable('clinics')
      table.integer('supervisor_id').unsigned().nullable().references('id').inTable('users')
      table.decimal('hourly_rate', 8, 2).nullable()
      table.string('phone').nullable()
      table.text('address').nullable()
      table.boolean('is_active').defaultTo(true)
      table.boolean('verified').defaultTo(false)
      table.json('permissions').nullable()
      table.string('remember_me_token').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}