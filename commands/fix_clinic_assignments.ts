import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import Clinic from '#models/clinic'

export default class FixClinicAssignments extends BaseCommand {
  static commandName = 'fix:clinic-assignments'
  static description = 'Assign all users without clinic_id to a default clinic'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Starting clinic assignment fix...')

    try {
      // Step 1: Check users without clinic
      const usersWithoutClinic = await User.query().whereNull('clinic_id')
      this.logger.info(`Found ${usersWithoutClinic.length} users without clinic assignment`)

      if (usersWithoutClinic.length === 0) {
        this.logger.success('All users already have clinic assignments!')
        return
      }

      // Step 2: Get or create default clinic
      let clinic = await Clinic.query().first()

      if (!clinic) {
        this.logger.info('No clinic found, creating default clinic...')
        clinic = await Clinic.create({
          name: 'ABA Connect Main Clinic',
          street: '123 Main Street',
          city: 'City',
          state: 'State',
          zipCode: '12345',
          phone: '555-0100',
          email: 'info@abaconnect.com',
        })
        this.logger.success(`Created clinic: ${clinic.name} (ID: ${clinic.id})`)
      } else {
        this.logger.info(`Using existing clinic: ${clinic.name} (ID: ${clinic.id})`)
      }

      // Step 3: Assign all users to the clinic
      const updateCount = await User.query()
        .whereNull('clinic_id')
        .update({ clinicId: clinic.id })

      this.logger.success(`Updated ${updateCount} users with clinic_id = ${clinic.id}`)

      // Step 4: Verify
      const remainingWithoutClinic = await User.query().whereNull('clinic_id').count('* as total')
      const usersWithClinic = await User.query().whereNotNull('clinic_id').count('* as total')

      this.logger.info('='.repeat(50))
      this.logger.info('Summary:')
      this.logger.info(`  Users with clinic: ${usersWithClinic[0].$extras.total}`)
      this.logger.info(`  Users without clinic: ${remainingWithoutClinic[0].$extras.total}`)
      this.logger.info('='.repeat(50))

      if (remainingWithoutClinic[0].$extras.total === 0) {
        this.logger.success('✅ All users now have clinic assignments!')
      } else {
        this.logger.warning(`⚠️  ${remainingWithoutClinic[0].$extras.total} users still without clinic`)
      }

      // Step 5: Show user details
      const allUsers = await User.query()
        .preload('clinic')
        .orderBy('role')
        .orderBy('name')

      this.logger.info('\nUser Details:')
      this.logger.info('-'.repeat(80))
      this.logger.info('ID | Name | Email | Role | Clinic')
      this.logger.info('-'.repeat(80))
      
      for (const user of allUsers) {
        const clinicName = user.clinic?.name || 'NO CLINIC'
        this.logger.info(`${user.id} | ${user.name} | ${user.email} | ${user.role} | ${clinicName}`)
      }
      this.logger.info('-'.repeat(80))

    } catch (error) {
      this.logger.error('Error fixing clinic assignments:')
      this.logger.error(error.message)
      throw error
    }
  }
}
