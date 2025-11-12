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
      table.string('street').notNullable().alter()
      table.string('city').notNullable().alter()
      table.string('state').notNullable().alter()
      table.string('zip_code').notNullable().alter()
      table.string('phone').notNullable()
      table.string('email').nullable()
      table.string('emergency_contact_name').notNullable().alter()
      table.string('emergency_contact_relationship').notNullable().alter()
      table.string('emergency_contact_phone').notNullable().alter()
      table.enum('insurance_type', ['insurance', 'private', 'regional']).notNullable().alter()
      table.string('insurance_id').notNullable().alter()
      table.string('insurance_policy_number').notNullable().alter()
      table.integer('clinic_id').unsigned().notNullable().references('id').inTable('clinics')
      table.integer('assigned_bcba').unsigned().nullable().references('id').inTable('users')
      table.enum('status', ['active', 'inactive', 'discharged']).defaultTo('active')
      table.date('admission_date').notNullable().alter()
      table.date('discharge_date').nullable().alter()
      table.json('diagnosis').nullable().alter()
      table.timestamp('created_at').notNullable().alter()
      table.timestamp('updated_at').nullable().alter()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}