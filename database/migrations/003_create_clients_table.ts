import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.date('date_of_birth').notNullable()
      table.string('social_security_number').nullable()
      table.string('street').nullable()
      table.string('city').nullable()
      table.string('state').nullable()
      table.string('zip_code').nullable()
      table.string('phone').notNullable()
      table.string('email').nullable()
      table.string('emergency_contact_name').nullable()
      table.string('emergency_contact_relationship').nullable()
      table.string('emergency_contact_phone').nullable()
      table.enum('insurance_type', ['insurance', 'private', 'regional']).notNullable()
      table.string('insurance_id').notNullable()
      table.string('insurance_policy_number').nullable()
      table.integer('clinic_id').unsigned().notNullable().references('id').inTable('clinics')
      table.integer('assigned_bcba').unsigned().nullable().references('id').inTable('users')
      table.enum('status', ['active', 'inactive', 'discharged']).defaultTo('active')
      table.date('admission_date').nullable()
      table.date('discharge_date').nullable()
      table.json('diagnosis').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}