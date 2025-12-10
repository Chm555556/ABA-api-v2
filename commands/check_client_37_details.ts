import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Client from '#models/client'

export default class CheckClient37Details extends BaseCommand {
  static commandName = 'check:client-37-details'
  static description = 'Check complete details for client 37'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Checking complete details for client 37...')

    try {
      const client = await Client.query()
        .where('id', 37)
        .preload('bcba')
        .preload('parent')
        .preload('assignedRbts')
        .preload('clinic')
        .preload('treatmentGoals')
        .first()

      if (!client) {
        this.logger.error('❌ Client 37 not found')
        return
      }

      this.logger.success(`✅ Client 37 found: ${client.firstName} ${client.lastName}`)
      
      // Basic info
      this.logger.info('\n📋 Basic Information:')
      this.logger.info(`  ID: ${client.id}`)
      this.logger.info(`  Full Name: ${client.fullName}`)
      this.logger.info(`  First Name: ${client.firstName}`)
      this.logger.info(`  Last Name: ${client.lastName}`)
      this.logger.info(`  Age: ${client.age}`)
      this.logger.info(`  Date of Birth: ${client.dateOfBirth}`)
      this.logger.info(`  Status: ${client.status}`)
      this.logger.info(`  Admission Date: ${client.admissionDate}`)

      // Contact info
      this.logger.info('\n📞 Contact Information:')
      this.logger.info(`  Phone: ${client.phone || 'NULL'}`)
      this.logger.info(`  Email: ${client.email || 'NULL'}`)
      this.logger.info(`  Street: ${client.street || 'NULL'}`)
      this.logger.info(`  City: ${client.city || 'NULL'}`)
      this.logger.info(`  State: ${client.state || 'NULL'}`)
      this.logger.info(`  Zip Code: ${client.zipCode || 'NULL'}`)

      // Emergency contact
      this.logger.info('\n🚨 Emergency Contact:')
      this.logger.info(`  Name: ${client.emergencyContactName || 'NULL'}`)
      this.logger.info(`  Phone: ${client.emergencyContactPhone || 'NULL'}`)
      this.logger.info(`  Relationship: ${client.emergencyContactRelationship || 'NULL'}`)

      // Medical info
      this.logger.info('\n🏥 Medical Information:')
      this.logger.info(`  Diagnosis: ${client.diagnosis || 'NULL'}`)
      this.logger.info(`  Insurance Type: ${client.insuranceType || 'NULL'}`)
      this.logger.info(`  Insurance ID: ${client.insuranceId || 'NULL'}`)

      // BCBA
      this.logger.info('\n👨‍⚕️ BCBA Information:')
      this.logger.info(`  Assigned BCBA ID: ${client.assignedBcba}`)
      if (client.bcba) {
        this.logger.info(`  BCBA Name: ${client.bcba.name}`)
        this.logger.info(`  BCBA Email: ${client.bcba.email}`)
      } else {
        this.logger.info(`  BCBA: Not loaded or NULL`)
      }

      // RBTs
      this.logger.info('\n👥 Assigned RBTs:')
      if (client.assignedRbts && client.assignedRbts.length > 0) {
        client.assignedRbts.forEach((rbt, index) => {
          this.logger.info(`  RBT ${index + 1}: ${rbt.name} (${rbt.email})`)
        })
      } else {
        this.logger.info(`  No RBTs assigned`)
      }

      // Parent
      this.logger.info('\n👨‍👩‍👧‍👦 Parent Information:')
      if (client.parent) {
        this.logger.info(`  Parent Name: ${client.parent.name}`)
        this.logger.info(`  Parent Email: ${client.parent.email}`)
        this.logger.info(`  Parent Phone: ${client.parent.phone || 'NULL'}`)
        this.logger.info(`  Parent Address: ${client.parent.address || 'NULL'}`)
        this.logger.info(`  Parent Role: ${client.parent.role || 'NULL'}`)
        this.logger.info(`  Parent Active: ${client.parent.isActive}`)
      } else {
        this.logger.info(`  Parent: Not assigned or NULL`)
      }

      // Clinic
      this.logger.info('\n🏢 Clinic Information:')
      if (client.clinic) {
        this.logger.info(`  Clinic Name: ${client.clinic.name}`)
        this.logger.info(`  Clinic Street: ${client.clinic.street || 'NULL'}`)
        this.logger.info(`  Clinic City: ${client.clinic.city || 'NULL'}`)
        this.logger.info(`  Clinic State: ${client.clinic.state || 'NULL'}`)
      } else {
        this.logger.info(`  Clinic: Not assigned or NULL`)
      }

      // Treatment Goals
      this.logger.info('\n🎯 Treatment Goals:')
      if (client.treatmentGoals && client.treatmentGoals.length > 0) {
        client.treatmentGoals.forEach((goal, index) => {
          this.logger.info(`  Goal ${index + 1}: ${goal.title} (Status: ${goal.status})`)
        })
      } else {
        this.logger.info(`  No treatment goals found`)
      }

    } catch (error) {
      this.logger.error('❌ Error:', error.message)
    }
  }
}