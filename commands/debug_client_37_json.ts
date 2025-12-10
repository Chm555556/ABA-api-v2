import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class DebugClient37Json extends BaseCommand {
  static commandName = 'debug:client-37-json'
  static description = 'Debug JSON parsing issues for client 37'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Debugging JSON issues for client 37...')

    try {
      // Check treatment goals for client 37
      const goals = await db.rawQuery(
        'SELECT id, title, prompt_hierarchy FROM treatment_goals WHERE client_id = 37'
      )

      this.logger.info(`Found ${goals[0].length} treatment goals for client 37`)

      goals[0].forEach((goal: any, index: number) => {
        this.logger.info(`\nGoal ${index + 1}:`)
        this.logger.info(`  ID: ${goal.id}`)
        this.logger.info(`  Title: ${goal.title}`)
        this.logger.info(`  Prompt Hierarchy Raw: ${goal.prompt_hierarchy}`)
        
        if (goal.prompt_hierarchy) {
          try {
            const parsed = JSON.parse(goal.prompt_hierarchy)
            this.logger.success(`  ✅ JSON Parse Success: ${JSON.stringify(parsed)}`)
          } catch (e) {
            this.logger.error(`  ❌ JSON Parse Error: ${e.message}`)
            this.logger.error(`  Raw data: "${goal.prompt_hierarchy}"`)
          }
        }
      })

      // Also check client data directly
      const client = await db.rawQuery(
        'SELECT id, first_name, last_name, diagnosis FROM clients WHERE id = 37'
      )

      if (client[0].length > 0) {
        const clientData = client[0][0]
        this.logger.info(`\nClient 37 diagnosis: ${clientData.diagnosis}`)
        
        if (clientData.diagnosis) {
          try {
            const parsed = JSON.parse(clientData.diagnosis)
            this.logger.success(`  ✅ Diagnosis JSON Parse Success: ${JSON.stringify(parsed)}`)
          } catch (e) {
            this.logger.error(`  ❌ Diagnosis JSON Parse Error: ${e.message}`)
          }
        }
      }

    } catch (error) {
      this.logger.error('❌ Error:', error.message)
      this.logger.error('Stack:', error.stack)
    }
  }
}