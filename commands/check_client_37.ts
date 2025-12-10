import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckClient37 extends BaseCommand {
  static commandName = 'check:client-37'
  static description = 'Check if client 37 exists'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Checking for client ID 37...')

    try {
      // Check if client 37 exists
      const client37 = await db.from('clients').where('id', 37).first()
      
      if (client37) {
        this.logger.success(`✅ Client 37 exists: ${client37.first_name} ${client37.last_name}, BCBA: ${client37.assigned_bcba}`)
      } else {
        this.logger.error('❌ Client 37 does not exist')
      }

      // Check all clients with higher IDs
      this.logger.info('\n📋 All clients with ID >= 30:')
      const highIdClients = await db.from('clients').where('id', '>=', 30).orderBy('id', 'asc')
      
      if (highIdClients.length > 0) {
        highIdClients.forEach(c => {
          this.logger.info(`  Client ID: ${c.id}, Name: ${c.first_name} ${c.last_name}, BCBA: ${c.assigned_bcba}`)
        })
      } else {
        this.logger.info('  No clients with ID >= 30 found')
      }

      // Check goals referencing client 37
      this.logger.info('\n🎯 Goals referencing client 37:')
      const goalsFor37 = await db.from('treatment_goals').where('client_id', 37)
      goalsFor37.forEach(g => {
        this.logger.info(`  Goal ID: ${g.id}, Title: ${g.title}`)
      })

    } catch (error) {
      this.logger.error('❌ Error:', error.message)
    }
  }
}