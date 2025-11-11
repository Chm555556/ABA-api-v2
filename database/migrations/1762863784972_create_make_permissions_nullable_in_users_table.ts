import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MakePermissionsNullableInUsers extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('permissions').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('permissions').notNullable().alter()
    })
  }
}
