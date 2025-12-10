import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class DebugClientGoals extends BaseCommand {
  static commandName = 'debug:client-goals'
  static description = 'Debug client and goal ID relationships'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Debugging Client-Goal ID Relationships...')

    try {
      // Check clients
      this.logger.info('📋 Clients in database:')
      const clients = await db.from('clients').select('id', 'first_name', 'last_name', 'assigned_bcba').limit(10)
      clients.forEach(c => {
        this.logger.info(`  Client ID: ${c.id}, Name: ${c.first_name} ${c.last_name}, BCBA: ${c.assigned_bcba}`)
      })

      // Check treatment goals
      this.logger.info('\n🎯 Treatment goals with client IDs:')
      const goals = await db.from('treatment_goals').select('id', 'client_id', 'title', 'created_by').limit(10)
      goals.forEach(g => {
        this.logger.info(`  Goal ID: ${g.id}, Client ID: ${g.client_id}, Title: ${g.title}, Created by: ${g.created_by}`)
      })

      // Check for mismatched client IDs
      this.logger.info('\n🔗 Checking for mismatched client IDs:')
      const mismatchedGoals = await db.rawQuery(`
        SELECT tg.id as goal_id, tg.client_id, tg.title, c.id as actual_client_id, c.first_name, c.last_name
        FROM treatment_goals tg
        LEFT JOIN clients c ON tg.client_id = c.id
        WHERE c.id IS NULL
        LIMIT 5
      `)

      if (mismatchedGoals[0].length > 0) {
        this.logger.error('❌ Found goals with invalid client IDs:')
        mismatchedGoals[0].forEach((g: any) => {
          this.logger.error(`  Goal ${g.goal_id}: references client_id ${g.client_id} but client doesn't exist`)
        })
      } else {
        this.logger.success('✅ All goals have valid client IDs')
      }

      // Check BCBA access
      this.logger.info('\n👨‍⚕️ BCBA users:')
      const bcbas = await db.from('users').select('id', 'name', 'email', 'role').where('role', 'BCBA').limit(5)
      bcbas.forEach(b => {
        this.logger.info(`  BCBA ID: ${b.id}, Name: ${b.name}, Email: ${b.email}`)
      })

    } catch (error) {
      this.logger.error('❌ Error:', error.message)
    }
  }
}