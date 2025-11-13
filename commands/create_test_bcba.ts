import { BaseCommand } from '@adonisjs/core/ace'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class CreateTestBcba extends BaseCommand {
  static commandName = 'create:test:bcba'
  static description = 'Create a test BCBA user'

  async run() {
    const email = 'testbcba@test.com'
    const password = 'Test123!'
    
    // Check if user exists
    const existing = await User.findBy('email', email)
    if (existing) {
      this.logger.info(`User ${email} already exists`)
      return
    }

    // Create user
    const user = await User.create({
      name: 'Test BCBA',
      email: email,
      password: await hash.make(password),
      role: 'BCBA',
      isActive: true,
      verified: true,
    })

    this.logger.success(`Created BCBA user: ${email} / ${password}`)
    this.logger.info(`User ID: ${user.id}`)
  }
}
