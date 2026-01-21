import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'

export default class CheckUser extends BaseCommand {
  static commandName = 'check:user'
  static description = 'Check user details and optionally reset password'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'User email to check' })
  declare email: string

  @flags.string({ description: 'New password to set (optional)' })
  declare password?: string

  async run() {
    this.logger.info(`🔍 Checking user: ${this.email}`)
    
    try {
      // Find user
      const user = await User.findBy('email', this.email)
      
      if (!user) {
        this.logger.error(`❌ User not found: ${this.email}`)
        this.logger.info('💡 Available users:')
        
        const allUsers = await User.query().select('email', 'role', 'is_active').limit(10)
        allUsers.forEach(u => {
          this.logger.info(`   ${u.email} (${u.role}) - ${u.isActive ? 'Active' : 'Inactive'}`)
        })
        return
      }
      
      this.logger.success('✅ User found:')
      this.logger.info(`   ID: ${user.id}`)
      this.logger.info(`   Name: ${user.name}`)
      this.logger.info(`   Email: ${user.email}`)
      this.logger.info(`   Role: ${user.role}`)
      this.logger.info(`   Active: ${user.isActive ? '✅' : '❌'}`)
      this.logger.info(`   Verified: ${user.verified ? '✅' : '❌'}`)
      this.logger.info(`   Created: ${user.createdAt.toFormat('yyyy-MM-dd HH:mm')}`)
      
      // Reset password if provided
      if (this.password) {
        this.logger.info(`🔄 Updating password...`)
        user.password = this.password
        await user.save()
        this.logger.success(`✅ Password updated successfully`)
        
        // Test the new password
        await user.refresh()
        const isValid = await user.verifyPassword(this.password)
        this.logger.info(`   Password verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`)
      }
      
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`)
    }
  }
}
