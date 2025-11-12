import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MakeAdmissionDateNullableInClients extends BaseSchema {
  protected tableName = 'clients'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('admission_date').nullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('admission_date').notNullable().alter()
    })
  }
}
