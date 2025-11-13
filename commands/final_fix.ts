import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class FinalFix extends BaseCommand {
  static commandName = 'final:fix'
  static description = 'Final fix for clinic_id issue - adds column and assigns clinic_id to all users'

  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    this.logger.info('🔧 Starting final fix for clinic_id issue...')
    this.logger.info('')

    try {
      // Step 1: Check if clinic_id column exists
      this.logger.info('📋 Step 1: Checking database schema...')
      const columns = await db.rawQuery('DESCRIBE users')
      const hasClinicId = columns[0].some((col: any) => col.Field === 'clinic_id')
      
      if (!hasClinicId) {
        this.logger.error('❌ clinic_id column does not exist in users table!')
        this.logger.info('💡 Please run: node ace migration:run')
        this.logger.info('')
        return
      }
      this.logger.success('✅ clinic_id column exists')
      this.logger.info('')

      // Step 2: Ensure default clinic exists
      this.logger.info('📋 Step 2: Checking for clinics...')
      const clinics = await db.from('clinics').select('*')
      
      let defaultClinicId: number
      
      if (clinics.length === 0) {
        this.logger.info('   Creating default clinic...')
        const [result] = await db.table('clinics').insert({
          name: 'ABA Connect Clinic',
          email: 'admin@abaconnect.com',
          phone: '555-0100',
          address: '123 Main Street, City, State 12345',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        defaultClinicId = result.insertId || result
        this.logger.success(`✅ Created default clinic (ID: ${defaultClinicId})`)
      } else {
        defaultClinicId = clinics[0].id
        this.logger.success(`✅ Using existing clinic: ${clinics[0].name} (ID: ${defaultClinicId})`)
      }
      this.logger.info('')

      // Step 3: Find users without clinic_id
      this.logger.info('📋 Step 3: Finding users without clinic_id...')
      const usersToUpdate = await db
        .from('users')
        .whereIn('role', ['CLINIC', 'BCBA', 'RBT'])
        .where((query) => {
          query.whereNull('clinic_id').orWhere('clinic_id', 0)
        })

      if (usersToUpdate.length === 0) {
        this.logger.success('✅ All users already have clinic_id assigned')
      } else {
        this.logger.info(`   Found ${usersToUpdate.length} users without clinic_id`)
        this.logger.info('   Updating...')
        
        const updated = await db
          .from('users')
          .whereIn('role', ['CLINIC', 'BCBA', 'RBT'])
          .where((query) => {
            query.whereNull('clinic_id').orWhere('clinic_id', 0)
          })
          .update({ clinic_id: defaultClinicId })

        this.logger.success(`✅ Updated ${updated} users with clinic_id: ${defaultClinicId}`)
      }
      this.logger.info('')

      // Step 4: Verify the fix
      this.logger.info('📋 Step 4: Verifying results...')
      const allUsers = await db
        .from('users')
        .select('id', 'name', 'email', 'role', 'clinic_id', 'is_active')
        .whereIn('role', ['CLINIC', 'BCBA', 'RBT'])
        .orderBy('role')
        .orderBy('name')

      this.logger.info('')
      this.logger.info('📊 Users Summary:')
      this.logger.info('─'.repeat(100))
      this.logger.info(
        `${'ID'.padEnd(6)} ${'Name'.padEnd(25)} ${'Email'.padEnd(35)} ${'Role'.padEnd(8)} ${'Clinic'.padEnd(8)} ${'Active'.padEnd(8)}`
      )
      this.logger.info('─'.repeat(100))

      allUsers.forEach((user: any) => {
        const status = user.is_active ? '✓' : '✗'
        this.logger.info(
          `${String(user.id).padEnd(6)} ${user.name.substring(0, 24).padEnd(25)} ${user.email.substring(0, 34).padEnd(35)} ${user.role.padEnd(8)} ${String(user.clinic_id || 'NULL').padEnd(8)} ${status.padEnd(8)}`
        )
      })
      this.logger.info('─'.repeat(100))
      this.logger.info('')

      // Check for remaining issues
      const usersWithoutClinic = allUsers.filter((u: any) => !u.clinic_id)
      if (usersWithoutClinic.length > 0) {
        this.logger.error(`❌ ${usersWithoutClinic.length} users still without clinic_id!`)
        this.logger.info('')
        return
      }

      // Success summary
      this.logger.success('✅ All users have clinic_id assigned!')
      this.logger.info('')
      this.logger.info('🎉 Fix completed successfully!')
      this.logger.info('')
      this.logger.info('📝 Next steps:')
      this.logger.info('   1. Restart backend: node ace serve --watch')
      this.logger.info('   2. Clear browser cache and cookies')
      this.logger.info('   3. Log out and log in again')
      this.logger.info('   4. Test the clinic dashboard')
      this.logger.info('')

    } catch (error) {
      this.logger.error('❌ Error during fix:')
      this.logger.error(error.message)
      if (process.env.NODE_ENV === 'development') {
        this.logger.error(error.stack)
      }
      this.logger.info('')
    }
  }
}
