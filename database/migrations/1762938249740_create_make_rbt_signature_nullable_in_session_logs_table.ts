import { BaseSchema } from '@adonisjs/lucid/schema'

export default class MakeRbtSignatureNullableInSessionLogs extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('rbt_signature').nullable().alter()
      table.string('parent_signature').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('rbt_signature').notNullable().alter()
      table.string('parent_signature').notNullable().alter()
    })
  }
}
