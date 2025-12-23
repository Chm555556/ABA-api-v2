import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'baseline_data'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add session tracking for baseline data
      table.integer('session_number').nullable() // Which baseline session (1, 2, 3, etc.)
      table.string('session_type').nullable() // 'baseline', 'probe', 'assessment'
      table.text('session_notes').nullable() // Notes about the entire session
      table.integer('total_trials_in_session').nullable() // Total trials in this session
      table.decimal('session_duration_minutes', 8, 2).nullable() // How long the session lasted
      table.string('environment').nullable() // Where baseline was collected (clinic, home, school)
      table.json('trial_details').nullable() // Detailed trial-by-trial data if needed
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('session_number')
      table.dropColumn('session_type')
      table.dropColumn('session_notes')
      table.dropColumn('total_trials_in_session')
      table.dropColumn('session_duration_minutes')
      table.dropColumn('environment')
      table.dropColumn('trial_details')
    })
  }
}