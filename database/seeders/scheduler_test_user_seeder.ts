import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class extends BaseSeeder {
  async run() {
    // Create Scheduler user
    await User.updateOrCreate(
      { email: 'scheduler@test.com' },
      {
        name: 'Test Scheduler',
        email: 'scheduler@test.com',
        password: await hash.make('Scheduler@1234'),
        role: 'SCHEDULER',
        isActive: true,
        verified: true,
        permissions: [],
      }
    )

    console.log('✅ Scheduler test user created: scheduler@test.com / Scheduler@1234')
  }
}
