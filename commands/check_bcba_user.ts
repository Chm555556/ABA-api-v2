
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class CheckBcbaUser extends BaseCommand {
  static commandName = 'check:bcba-user'
  static description = 'Check BCBA user details'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Checking BCBA user details...')

    try {
      const bcba = await db.from('users').where('id', 12).first()
      
      if (!bcba) {
        this.logger.error('❌ BCBA user 12 not found')
        return
      }

      this.logger.info('\n👨‍⚕️ BCBA User 12 Details:')
      this.logger.info(`  Name: ${bcba.name}`)
      this.logger.info(`  Email: ${bcba.email}`)
      this.logger.info(`  Role: ${bcba.role}`)
      this.logger.info(`  Password Hash: ${bcba.password ? 'Present' : 'Missing'}`)
      this.logger.info(`  Is Active: ${bcba.is_active}`)
      this.logger.info(`  Created At: ${bcba.created_at}`)

      // Check if there are any access tokens for this user
      const tokens = await db.from('access_tokens').where('tokenable_id', 12).limit(5)
      this.logger.info(`\n🔑 Access Tokens: ${tokens.length} found`)
      
      if (tokens.length > 0) {
        tokens.forEach((token, index) => {
          this.logger.info(`  Token ${index + 1}: ${token.hash.substring(0, 20)}... (Created: ${token.created_at})`)
        })
      }

    } catch (error) {
      this.logger.error('❌ Error:', error.message)
    }
  }
}