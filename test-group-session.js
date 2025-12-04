// Test script to check for group/community sessions
// Run with: node ace run test-group-session.js

import { BaseCommand } from '@adonisjs/core/ace'
import SessionLog from '#models/session_log'
import SessionParticipant from '#models/session_participant'

export default class TestGroupSession extends BaseCommand {
  static commandName = 'test:group-session'
  static description = 'Check for group/community sessions'

  async run() {
    this.logger.info('Checking for group/community sessions...')

    // Find all group/community sessions
    const groupSessions = await SessionLog.query()
      .whereIn('session_type', ['group', 'community'])
      .preload('participants', (query) => {
        query.preload('client')
      })
      .limit(10)

    this.logger.info(`Found ${groupSessions.length} group/community sessions`)

    for (const session of groupSessions) {
      this.logger.info(`\nSession ID: ${session.id}`)
      this.logger.info(`Type: ${session.sessionType}`)
      this.logger.info(`Date: ${session.date.toISODate()}`)
      this.logger.info(`RBT ID: ${session.rbtId}`)
      this.logger.info(`Participants: ${session.participants?.length || 0}`)
      
      if (session.participants && session.participants.length > 0) {
        session.participants.forEach((p, idx) => {
          this.logger.info(`  ${idx + 1}. Client ID: ${p.clientId}, Name: ${p.client?.fullName || 'N/A'}`)
        })
      }
    }

    // If no group sessions exist, let's check all sessions
    if (groupSessions.length === 0) {
      this.logger.warning('No group/community sessions found. Checking all sessions...')
      
      const allSessions = await SessionLog.query()
        .where('rbt_id', 11)
        .select('id', 'session_type', 'client_id', 'date')
        .limit(20)

      this.logger.info(`\nAll sessions for RBT 11:`)
      allSessions.forEach(s => {
        this.logger.info(`  Session ${s.id}: Type=${s.sessionType}, ClientId=${s.clientId}, Date=${s.date.toISODate()}`)
      })
    }
  }
}
