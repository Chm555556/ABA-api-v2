import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'

export default class CheckScheduler extends BaseCommand {
  static commandName = 'check:scheduler'
  static description = 'Check scheduler user and test password'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Checking scheduler user...')
    
    try {
      // Find scheduler user
      const scheduler = await User.findBy('email', 'scheduler@test.com')
      
      if (!scheduler) {
        this.logger.error('❌ Scheduler user not found')
        return
      }
      
      this.logger.info('✅ Scheduler user found:')
      this.logger.info(`  ID: ${scheduler.id}`)
      this.logger.info(`  Name: ${scheduler.name}`)
      this.logger.info(`  Email: ${scheduler.email}`)
      this.logger.info(`  Role: ${scheduler.role}`)
      this.logger.info(`  Active: ${scheduler.isActive}`)
      this.logger.info(`  Verified: ${scheduler.verified}`)
      
      // Test password
      const testPassword = 'Scheduler@1234'
      const isValid = await scheduler.verifyPassword(testPassword)
      this.logger.info(`  Password test: ${isValid ? '✅ Valid' : '❌ Invalid'}`)
      
      if (!isValid) {
        this.logger.warning('Password verification failed. Updating password...')
        scheduler.password = testPassword
        await scheduler.save()
        this.logger.success('Password updated successfully')
        
        // Test again
        await scheduler.refresh()
        const isValidNow = await scheduler.verifyPassword(testPassword)
        this.logger.info(`  Password test after update: ${isValidNow ? '✅ Valid' : '❌ Invalid'}`)
      }
      
    } catch (error) {
      this.logger.error(`Error: ${error.message}`)
    }
  }
}
