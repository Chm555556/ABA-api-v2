import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MakeEmergencyFieldsNullableInClients extends BaseSchema {
  protected tableName = 'clients'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('emergency_contact_name').nullable().alter()
      table.string('emergency_contact_relationship').nullable().alter()
      table.string('emergency_contact_phone').nullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('emergency_contact_name').notNullable().alter()
      table.string('emergency_contact_relationship').notNullable().alter()
      table.string('emergency_contact_phone').notNullable().alter()
    })
  }
}
