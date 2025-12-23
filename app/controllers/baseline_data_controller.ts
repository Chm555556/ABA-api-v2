import type { HttpContext } from '@adonisjs/core/http'
import BaselineData from '#models/baseline_data'
import TreatmentGoal from '#models/treatment_goal'
import Client from '#models/client'
import { DateTime } from 'luxon'

export default class BaselineDataController {
  /**
   * Get baseline data for a treatment goal
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const goalId = request.input('goalId')

      if (!goalId) {
        return response.status(400).json({
          message: 'Goal ID is required',
        })
      }

      // Verify user has access to this goal
      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions based on user role
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'RBT') {
        // Verify RBT has access to this client
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      if (user.role === 'PARENT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .where('parentId', user.id)
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      // Get baseline data for this goal
      const baselineData = await BaselineData.query()
        .where('goalId', goalId)
        .preload('collector')
        .orderBy('collectionDate', 'desc')

      return response.json({
        data: baselineData.map(baseline => ({
          id: baseline.id,
          goalId: baseline.goalId,
          score: baseline.score,
          trials: baseline.trials,
          collectionDate: baseline.collectionDate.toISODate(),
          notes: baseline.notes,
          collectedBy: baseline.collectedBy,
          collectorName: baseline.collector?.name || null,
          sessionNumber: baseline.sessionNumber,
          sessionType: baseline.sessionType,
          sessionNotes: baseline.sessionNotes,
          totalTrialsInSession: baseline.totalTrialsInSession,
          sessionDurationMinutes: baseline.sessionDurationMinutes,
          environment: baseline.environment,
          trialDetails: baseline.trialDetails,
          createdAt: baseline.createdAt.toISO(),
        })),
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch baseline data',
        error: error.message,
      })
    }
  }

  /**
   * Create new baseline data entry
   */
  async store({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const {
        goalId,
        score,
        trials,
        collectionDate,
        notes,
        sessionNumber,
        sessionType,
        sessionNotes,
        totalTrialsInSession,
        sessionDurationMinutes,
        environment,
        trialDetails,
      } = request.only([
        'goalId',
        'score',
        'trials',
        'collectionDate',
        'notes',
        'sessionNumber',
        'sessionType',
        'sessionNotes',
        'totalTrialsInSession',
        'sessionDurationMinutes',
        'environment',
        'trialDetails',
      ])

      // Verify user has access to this goal
      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions based on user role
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'RBT') {
        // Verify RBT has access to this client
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      // Create baseline data entry
      const baselineData = await BaselineData.create({
        goalId,
        score: parseFloat(score),
        trials: trials ? parseInt(trials) : null,
        collectionDate: DateTime.fromISO(collectionDate),
        notes,
        sessionNumber: sessionNumber ? parseInt(sessionNumber) : null,
        sessionType,
        sessionNotes,
        totalTrialsInSession: totalTrialsInSession ? parseInt(totalTrialsInSession) : null,
        sessionDurationMinutes: sessionDurationMinutes ? parseFloat(sessionDurationMinutes) : null,
        environment,
        trialDetails,
        collectedBy: user.id,
      })

      await baselineData.load('collector')

      return response.status(201).json({
        message: 'Baseline data created successfully',
        data: {
          id: baselineData.id,
          goalId: baselineData.goalId,
          score: baselineData.score,
          trials: baselineData.trials,
          collectionDate: baselineData.collectionDate.toISODate(),
          notes: baselineData.notes,
          collectedBy: baselineData.collectedBy,
          collectorName: baselineData.collector?.name || null,
          sessionNumber: baselineData.sessionNumber,
          sessionType: baselineData.sessionType,
          sessionNotes: baselineData.sessionNotes,
          totalTrialsInSession: baselineData.totalTrialsInSession,
          sessionDurationMinutes: baselineData.sessionDurationMinutes,
          environment: baselineData.environment,
          trialDetails: baselineData.trialDetails,
          createdAt: baselineData.createdAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to create baseline data',
        error: error.message,
      })
    }
  }

  /**
   * Update baseline data entry
   */
  async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const baselineId = params.id
      const updates = request.only([
        'score',
        'trials',
        'collectionDate',
        'notes',
        'sessionNumber',
        'sessionType',
        'sessionNotes',
        'totalTrialsInSession',
        'sessionDurationMinutes',
        'environment',
        'trialDetails',
      ])

      // Get baseline data and load related goal and client
      const baselineData = await BaselineData.findOrFail(baselineId)
      const goal = await TreatmentGoal.query()
        .where('id', baselineData.goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      if (user.role === 'RBT') {
        // Verify RBT has access to this client
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied',
          })
        }
      }

      // Update baseline data
      if (updates.score) updates.score = parseFloat(updates.score)
      if (updates.trials) updates.trials = parseInt(updates.trials)
      if (updates.collectionDate) updates.collectionDate = DateTime.fromISO(updates.collectionDate)
      if (updates.sessionNumber) updates.sessionNumber = parseInt(updates.sessionNumber)
      if (updates.totalTrialsInSession) updates.totalTrialsInSession = parseInt(updates.totalTrialsInSession)
      if (updates.sessionDurationMinutes) updates.sessionDurationMinutes = parseFloat(updates.sessionDurationMinutes)

      baselineData.merge(updates)
      await baselineData.save()

      await baselineData.load('collector')

      return response.json({
        message: 'Baseline data updated successfully',
        data: {
          id: baselineData.id,
          goalId: baselineData.goalId,
          score: baselineData.score,
          trials: baselineData.trials,
          collectionDate: baselineData.collectionDate.toISODate(),
          notes: baselineData.notes,
          collectedBy: baselineData.collectedBy,
          collectorName: baselineData.collector?.name || null,
          sessionNumber: baselineData.sessionNumber,
          sessionType: baselineData.sessionType,
          sessionNotes: baselineData.sessionNotes,
          totalTrialsInSession: baselineData.totalTrialsInSession,
          sessionDurationMinutes: baselineData.sessionDurationMinutes,
          environment: baselineData.environment,
          trialDetails: baselineData.trialDetails,
          updatedAt: baselineData.updatedAt.toISO(),
        },
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to update baseline data',
        error: error.message,
      })
    }
  }

  /**
   * Delete baseline data entry
   */
  async destroy({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const baselineId = params.id

      // Get baseline data and load related goal and client
      const baselineData = await BaselineData.findOrFail(baselineId)
      const goal = await TreatmentGoal.query()
        .where('id', baselineData.goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied',
        })
      }

      await baselineData.delete()

      return response.json({
        message: 'Baseline data deleted successfully',
      })
    } catch (error) {
      return response.status(400).json({
        message: 'Failed to delete baseline data',
        error: error.message,
      })
    }
  }

  /**
   * Get baseline summary for a goal (average, latest, etc.)
   */
  async summary({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const goalId = request.input('goalId')

      if (!goalId) {
        return response.status(400).json({
          message: 'Goal ID is required',
        })
      }

      // Verify user has access to this goal
      const goal = await TreatmentGoal.query()
        .where('id', goalId)
        .preload('client')
        .firstOrFail()

      // Check permissions (same as index method)
      if (user.role === 'BCBA' && goal.createdBy !== user.id) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'CLINIC' && goal.client.clinicId !== user.clinicId) {
        return response.status(403).json({
          message: 'Access denied to this goal',
        })
      }

      if (user.role === 'RBT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .whereHas('assignedRbts', (rbtQuery) => {
            rbtQuery.where('users.id', user.id)
          })
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      if (user.role === 'PARENT') {
        const hasAccess = await Client.query()
          .where('id', goal.clientId)
          .where('parentId', user.id)
          .first()

        if (!hasAccess) {
          return response.status(403).json({
            message: 'Access denied to this goal',
          })
        }
      }

      // Get baseline data for calculations
      const baselineData = await BaselineData.query()
        .where('goalId', goalId)
        .orderBy('collectionDate', 'asc')

      if (baselineData.length === 0) {
        return response.json({
          data: {
            count: 0,
            averageScore: null,
            latestScore: null,
            earliestScore: null,
            dateRange: null,
            trend: null,
          },
        })
      }

      // Calculate summary statistics
      const scores = baselineData.map(b => b.score)
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
      const latestEntry = baselineData[baselineData.length - 1]
      const earliestEntry = baselineData[0]

      // Calculate trend (simple comparison of first vs last)
      let trend = 'stable'
      if (baselineData.length >= 2) {
        const firstScore = earliestEntry.score
        const lastScore = latestEntry.score
        const percentChange = ((lastScore - firstScore) / firstScore) * 100
        
        if (percentChange > 5) trend = 'improving'
        else if (percentChange < -5) trend = 'declining'
      }

      return response.json({
        data: {
          count: baselineData.length,
          averageScore: Math.round(averageScore * 100) / 100,
          latestScore: latestEntry.score,
          latestDate: latestEntry.collectionDate.toISODate(),
          earliestScore: earliestEntry.score,
          earliestDate: earliestEntry.collectionDate.toISODate(),
          dateRange: {
            start: earliestEntry.collectionDate.toISODate(),
            end: latestEntry.collectionDate.toISODate(),
          },
          trend,
          entries: baselineData.map(baseline => ({
            date: baseline.collectionDate.toISODate(),
            score: baseline.score,
            trials: baseline.trials,
          })),
        },
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Failed to fetch baseline summary',
        error: error.message,
      })
    }
  }
}