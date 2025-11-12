import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MakeAddressFieldsNullableInClients extends BaseSchema {
  protected tableName = 'clients'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('street').nullable().alter()
      table.string('city').nullable().alter()
      table.string('state').nullable().alter()
      table.string('zip_code').nullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('street').notNullable().alter()
      table.string('city').notNullable().alter()
      table.string('state').notNullable().alter()
      table.string('zip_code').notNullable().alter()
    })
  }
}
