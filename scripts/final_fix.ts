import db from '@adonisjs/lucid/services/db'
import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class FinalFix extends BaseCommand {
  static commandName = 'final:fix'
  static description = 'Final fix for clinic_id issue'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔧 Starting final fix for clinic_id issue...')

    try {
      // Step 1: Check if clinic_id column exists
      this.logger.info('📋 Step 1: Checking if clinic_id column exists...')
      const columns = await db.rawQuery('DESCRIBE users')
      const hasClinicId = columns.some((col: any) => col.Field === 'clinic_id')
      
      if (!hasClinicId) {
        this.logger.error('❌ clinic_id column does not exist in users table!')
        this.logger.info('💡 Run: node ace migration:run')
        return
      }
      this.logger.success('✅ clinic_id column exists')

      // Step 2: Create default clinic if none exists
      this.logger.info('📋 Step 2: Ensuring default clinic exists...')
      const clinics = await db.from('clinics').select('*')
      
      let defaultClinicId: number
      
      if (clinics.length === 0) {
        this.logger.info('Creating default clinic...')
        const [result] = await db.table('clinics').insert({
          name: 'ABA Connect Clinic',
          email: 'admin@abaconnect.com',
          phone: '555-0100',
          address: '123 Main Street, City, State 12345',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        defaultClinicId = result
        this.logger.success(`✅ Created default clinic with ID: ${defaultClinicId}`)
      } else {
        defaultClinicId = clinics[0].id
        this.logger.success(`✅ Using existing clinic with ID: ${defaultClinicId}`)
      }

      // Step 3: Update users without clinic_id
      this.logger.info('📋 Step 3: Updating users without clinic_id...')
      const usersToUpdate = await db
        .from('users')
        .whereIn('role', ['CLINIC', 'BCBA', 'RBT'])
        .whereNull('clinic_id')
        .orWhere('clinic_id', 0)

      if (usersToUpdate.length === 0) {
        this.logger.success('✅ All users already have clinic_id assigned')
      } else {
        this.logger.info(`Found ${usersToUpdate.length} users without clinic_id`)
        
        await db
          .from('users')
          .whereIn('role', ['CLINIC', 'BCBA', 'RBT'])
          .whereNull('clinic_id')
          .orWhere('clinic_id', 0)
          .update({ clinic_id: defaultClinicId })

        this.logger.success(`✅ Updated ${usersToUpdate.length} users with clinic_id: ${defaultClinicId}`)
      }

      // Step 4: Verify the fix
      this.logger.info('📋 Step 4: Verifying the fix...')
      const users = await db
        .from('users')
        .select('id', 'name', 'email', 'role', 'clinic_id')
        .whereIn('role', ['CLINIC', 'BCBA', 'RBT'])
        .orderBy('role')
        .orderBy('name')

      this.logger.info('\n📊 Users Summary:')
      this.logger.info('─'.repeat(80))
      this.logger.info(
        `${'ID'.padEnd(5)} ${'Name'.padEnd(20)} ${'Email'.padEnd(30)} ${'Role'.padEnd(10)} ${'Clinic ID'.padEnd(10)}`
      )
      this.logger.info('─'.repeat(80))

      users.forEach((user: any) => {
        this.logger.info(
          `${String(user.id).padEnd(5)} ${user.name.padEnd(20).substring(0, 20)} ${user.email.padEnd(30).substring(0, 30)} ${user.role.padEnd(10)} ${String(user.clinic_id || 'NULL').padEnd(10)}`
        )
      })
      this.logger.info('─'.repeat(80))

      // Check for any remaining issues
      const usersWithoutClinic = users.filter((u: any) => !u.clinic_id)
      if (usersWithoutClinic.length > 0) {
        this.logger.error(`❌ ${usersWithoutClinic.length} users still without clinic_id!`)
        return
      }

      this.logger.success('\n✅ All users have clinic_id assigned!')
      this.logger.info('\n🎉 Fix completed successfully!')
      this.logger.info('\n📝 Next steps:')
      this.logger.info('   1. Restart your backend server: node ace serve --watch')
      this.logger.info('   2. Clear browser cache and cookies')
      this.logger.info('   3. Log out and log in again')
      this.logger.info('   4. Test the clinic dashboard')

    } catch (error) {
      this.logger.error('❌ Error during fix:', error.message)
      this.logger.error(error.stack)
    }
  }
}
