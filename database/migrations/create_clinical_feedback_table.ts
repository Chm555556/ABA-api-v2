import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clinical_feedback'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('session_id').unsigned().references('id').inTable('session_logs').onDelete('CASCADE')
      table.integer('patient_id').unsigned().references('id').inTable('clients').onDelete('CASCADE')
      table.integer('clinician_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.date('date').notNullable()
      table.text('category_scores').notNullable() // JSON string
      table.integer('overall_score').notNullable()
      table.integer('engagement_level').notNullable()
      table.text('risk_factors').nullable() // JSON string
      table.text('comments').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}