import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clinics'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('street').notNullable()
      table.string('city').notNullable()
      table.string('state').notNullable()
      table.string('zip_code').notNullable()
      table.string('phone').notNullable()
      table.string('email').notNullable()
      table.string('npi_number').nullable()
      table.string('tax_id').nullable()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}