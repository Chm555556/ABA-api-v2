import { BaseCommand } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import SessionLog from '#models/session_log'
import SessionParticipant from '#models/session_participant'
import Client from '#models/client'

export default class CreateDemoSessions extends BaseCommand {
  static commandName = 'create:demo-sessions'
  static description = 'Create demo group and community sessions for testing and training'

  async run() {
    this.logger.info('🔧 Creating demo group sessions for training and testing...')

    // Configuration
    const RBT_ID = 11 // iamrbt
    const BCBA_ID = 1 // Adjust based on your database

    // Get some clients to add as participants
    const clients = await Client.query()
      .where('status', 'active')
      .limit(3)

    if (clients.length < 2) {
      this.logger.error('❌ Need at least 2 active clients to create a group session')
      return
    }

    this.logger.info(`✅ Found ${clients.length} clients:`)
    clients.forEach(c => this.logger.info(`   - ${c.fullName} (ID: ${c.id})`))

    // Create a group session
    const groupSession = await SessionLog.create({
      clientId: null, // Group sessions don't have a single client
      rbtId: RBT_ID,
      bcbaId: BCBA_ID,
      date: DateTime.now().plus({ days: 1 }),
      startTime: '10:00',
      endTime: '11:30',
      duration: 90,
      totalHours: 1.5,
      cptCode: '97153',
      serviceType: 'Direct Service',
      location: 'clinic',
      locationAddress: '123 Main St, City, State 12345',
      sessionType: 'group',
      sessionNotes: 'Test group session with multiple participants',
      rbtSignature: 'iamrbt',
      status: 'approved',
      bcbaApproved: false,
      clinicApproved: false,
      isRecurring: false,
      isSeriesMaster: false,
    })

    this.logger.info(`✅ Created group session ID: ${groupSession.id}`)

    // Add participants
    for (const client of clients) {
      const participant = await SessionParticipant.create({
        sessionLogId: groupSession.id,
        clientId: client.id,
        notes: `Participant: ${client.fullName}`,
      })
      this.logger.info(`   ✅ Added participant: ${client.fullName} (Participant ID: ${participant.id})`)
    }

    // Create a community session as well
    const communitySession = await SessionLog.create({
      clientId: null,
      rbtId: RBT_ID,
      bcbaId: BCBA_ID,
      date: DateTime.now().plus({ days: 2 }),
      startTime: '14:00',
      endTime: '16:00',
      duration: 120,
      totalHours: 2.0,
      cptCode: '97153',
      serviceType: 'Direct Service',
      location: 'community',
      locationAddress: 'Community Center, 456 Park Ave',
      sessionType: 'community',
      sessionNotes: 'Test community session with multiple participants',
      rbtSignature: 'iamrbt',
      status: 'approved',
      bcbaApproved: false,
      clinicApproved: false,
      isRecurring: false,
      isSeriesMaster: false,
    })

    this.logger.info(`✅ Created community session ID: ${communitySession.id}`)

    // Add participants to community session
    for (const client of clients.slice(0, 2)) {
      const participant = await SessionParticipant.create({
        sessionLogId: communitySession.id,
        clientId: client.id,
        notes: `Community participant: ${client.fullName}`,
      })
      this.logger.info(`   ✅ Added participant: ${client.fullName} (Participant ID: ${participant.id})`)
    }

    this.logger.info('\n🎉 Demo sessions created successfully!')
    this.logger.info(`\n📋 Summary:`)
    this.logger.info(`   Group Session ID: ${groupSession.id} (${clients.length} participants)`)
    this.logger.info(`   Community Session ID: ${communitySession.id} (2 participants)`)
    this.logger.info(`\n💡 View these sessions in the RBT Dashboard → My Sessions → View Details`)
    this.logger.info(`\n🎯 Use these sessions for:`)
    this.logger.info(`   - Training new RBTs on group session workflows`)
    this.logger.info(`   - Testing group session functionality`)
    this.logger.info(`   - Demonstrating multi-participant sessions to stakeholders`)
  }
}
