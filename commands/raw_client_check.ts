import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class RawClientCheck extends BaseCommand {
  static commandName = 'raw:client-check'
  static description = 'Check raw client data'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Checking raw client data...')

    try {
      // Get client 37 raw data
      const client = await db.from('clients').where('id', 37).first()
      
      if (!client) {
        this.logger.error('❌ Client 37 not found')
        return
      }

      this.logger.info('\n📋 Client 37 Raw Data:')
      Object.keys(client).forEach(key => {
        const value = client[key]
        this.logger.info(`  ${key}: ${value === null ? 'NULL' : value}`)
      })

      // Check parent if exists
      if (client.parent_id) {
        this.logger.info('\n👨‍👩‍👧‍👦 Parent Data:')
        const parent = await db.from('users').where('id', client.parent_id).first()
        if (parent) {
          Object.keys(parent).forEach(key => {
            if (['id', 'name', 'email', 'phone', 'address', 'role', 'is_active'].includes(key)) {
              const value = parent[key]
              this.logger.info(`  ${key}: ${value === null ? 'NULL' : value}`)
            }
          })
        } else {
          this.logger.info('  Parent not found')
        }
      } else {
        this.logger.info('\n👨‍👩‍👧‍👦 Parent: NULL')
      }

      // Check BCBA
      if (client.assigned_bcba) {
        this.logger.info('\n👨‍⚕️ BCBA Data:')
        const bcba = await db.from('users').where('id', client.assigned_bcba).first()
        if (bcba) {
          this.logger.info(`  id: ${bcba.id}`)
          this.logger.info(`  name: ${bcba.name}`)
          this.logger.info(`  email: ${bcba.email}`)
          this.logger.info(`  role: ${bcba.role}`)
        } else {
          this.logger.info('  BCBA not found')
        }
      } else {
        this.logger.info('\n👨‍⚕️ BCBA: NULL')
      }

      // Check clinic
      if (client.clinic_id) {
        this.logger.info('\n🏢 Clinic Data:')
        const clinic = await db.from('clinics').where('id', client.clinic_id).first()
        if (clinic) {
          Object.keys(clinic).forEach(key => {
            if (['id', 'name', 'street', 'city', 'state'].includes(key)) {
              const value = clinic[key]
              this.logger.info(`  ${key}: ${value === null ? 'NULL' : value}`)
            }
          })
        } else {
          this.logger.info('  Clinic not found')
        }
      } else {
        this.logger.info('\n🏢 Clinic: NULL')
      }

    } catch (error) {
      this.logger.error('❌ Error:', error.message)
      this.logger.error(error.stack)
    }
  }
}