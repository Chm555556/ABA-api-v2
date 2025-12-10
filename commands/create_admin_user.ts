import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class CreateAdminUser extends BaseCommand {
  static commandName = 'create:admin-user'
  static description = 'Create an admin user (BCBA, ADMIN, or SCHEDULER)'

  @args.string({ description: 'User name' })
  declare name: string

  @args.string({ description: 'User email' })
  declare email: string

  @flags.string({ description: 'User role (ADMIN, BCBA, SCHEDULER)', default: 'BCBA' })
  declare role: string

  @flags.string({ description: 'User password', default: 'Admin123!' })
  declare password: string

  async run() {
    const validRoles = ['ADMIN', 'BCBA', 'SCHEDULER']
    
    if (!validRoles.includes(this.role.toUpperCase())) {
      this.logger.error(`Invalid role: ${this.role}. Valid roles: ${validRoles.join(', ')}`)
      return
    }

    // Check if user exists
    const existing = await User.findBy('email', this.email)
    if (existing) {
      this.logger.warning(`User ${this.email} already exists`)
      this.logger.info(`Existing user: ${existing.name} (${existing.role})`)
      return
    }

    try {
      // Create user
      const user = await User.create({
        name: this.name,
        email: this.email,
        password: await hash.make(this.password),
        role: this.role.toUpperCase(),
        isActive: true,
        verified: true,
      })

      this.logger.success(`✅ Created ${this.role.toUpperCase()} user successfully!`)
      this.logger.info(`   Name: ${user.name}`)
      this.logger.info(`   Email: ${user.email}`)
      this.logger.info(`   Role: ${user.role}`)
      this.logger.info(`   Password: ${this.password}`)
      this.logger.info(`   User ID: ${user.id}`)
      
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`)
    }
  }
}
