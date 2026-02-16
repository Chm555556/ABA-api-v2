import type { HttpContext } from '@adonisjs/core/http'
import axios from 'axios'
import ParentContextService from '#services/parent_context_service'
import User from '#models/user'

export default class LiveAvatarController {
  private parentContextService: ParentContextService

  constructor() {
    this.parentContextService = new ParentContextService()
  }

  /**
   * Create a LiveAvatar session token
   * This endpoint creates a session token for the LiveAvatar consultation
   * Accepts optional parent_id to personalize the consultation
   */
  async createSessionToken({ request, auth, response }: HttpContext) {
    try {
      const apiKey = process.env.LIVEAVATAR_API_KEY

      if (!apiKey) {
        return response.status(500).json({
          error: 'LiveAvatar API key not configured',
        })
      }

      // Get parent ID from request body or authenticated user
      let parentId: number | null = null
      const body = request.only(['parent_id'])

      console.log('=== CREATE SESSION TOKEN ===')
      console.log('Request body:', body)
      console.log('Auth user:', auth.user ? { id: auth.user.id, role: auth.user.role } : 'none')

      if (body.parent_id) {
        parentId = parseInt(body.parent_id)
        console.log('Parent ID from request body:', parentId)

        // Validate parent_id exists and has role='PARENT'
        const parent = await User.find(parentId)
        if (!parent || parent.role !== 'PARENT') {
          console.log('Invalid parent ID or role:', parent ? parent.role : 'not found')
          return response.status(400).json({
            error: 'Invalid parent ID',
          })
        }
        console.log('Parent validated:', parent.name, parent.email)
      } else if (auth.user && auth.user.role === 'PARENT') {
        // Use authenticated user's ID if they are a parent
        parentId = auth.user.id
        console.log('Parent ID from auth user:', parentId)
      }

      // Get parent-specific context or use default
      let contextId = process.env.LIVEAVATAR_CONTEXT_ID || 'default_context'
      let parentContext = null

      if (parentId) {
        try {
          console.log('Fetching parent context for parent_id:', parentId)
          parentContext = await this.parentContextService.getParentContext(parentId)
          console.log('Parent context fetched successfully')
          console.log('Context summary:', parentContext.knowledge_base.parent_summary)
          console.log('Children details count:', parentContext.knowledge_base.children_details.length)
          console.log('Recent activity count:', parentContext.knowledge_base.recent_activity.length)
          console.log('Treatment goals count:', parentContext.knowledge_base.treatment_goals.length)

          // Log session creation with parent_id for auditing
          console.log(`Session token created for parent ${parentId} at ${new Date().toISOString()}`)
        } catch (error) {
          console.error('Failed to get parent context:', error)
          console.error('Error details:', error.message)
        }
      } else {
        console.log('No parent ID provided, using generic consultation')
      }

      // Create session token with LiveAvatar API
      const sessionResponse = await axios.post(
        'https://api.liveavatar.com/v1/sessions/token',
        {
          mode: 'FULL',
          avatar_id: process.env.LIVEAVATAR_AVATAR_ID || 'default_avatar',
          avatar_persona: {
            voice_id: process.env.LIVEAVATAR_VOICE_ID || 'default_voice',
            context_id: contextId,
            language: 'en',
          },
        },
        {
          headers: {
            'X-API-KEY': apiKey,
            'accept': 'application/json',
            'content-type': 'application/json',
          },
        }
      )

      console.log('HeyGen session created successfully')

      const responseData: any = {
        session_id: sessionResponse.data.data.session_id,
        session_token: sessionResponse.data.data.session_token,
      }

      // Include parent context in response if available
      if (parentContext) {
        responseData.parent_context = parentContext.knowledge_base
        responseData.has_personalized_context = true
        console.log('Including parent context in response')
      } else {
        console.log('No parent context to include')
      }

      return response.json(responseData)
    } catch (error) {
      console.error('LiveAvatar session creation error:', error)
      return response.status(500).json({
        error: 'Failed to create LiveAvatar session',
        details: error.response?.data || error.message,
      })
    }
  }

  /**
   * Start a LiveAvatar session
   * This endpoint starts the session and returns LiveKit room details
   */
  async startSession({ request, response }: HttpContext) {
    try {
      const { session_token } = request.only(['session_token'])

      if (!session_token) {
        return response.status(400).json({
          error: 'Session token is required',
        })
      }

      // Start the session
      const startResponse = await axios.post(
        'https://api.liveavatar.com/v1/sessions/start',
        {},
        {
          headers: {
            'accept': 'application/json',
            'authorization': `Bearer ${session_token}`,
          },
        }
      )

      return response.json(startResponse.data)
    } catch (error) {
      console.error('LiveAvatar session start error:', error)
      return response.status(500).json({
        error: 'Failed to start LiveAvatar session',
        details: error.response?.data || error.message,
      })
    }
  }

  /**
   * Get ABA consultation knowledge base
   * This returns dummy data that the LiveAvatar can reference
   */
  async getKnowledgeBase({ response }: HttpContext) {
    const knowledgeBase = {
      organization: {
        name: 'ABA Connect',
        description: 'Leading provider of Applied Behavior Analysis (ABA) therapy services',
        services: [
          'One-on-one ABA therapy',
          'Group therapy sessions',
          'Parent training and support',
          'Behavior assessments',
          'Treatment plan development',
          'Progress monitoring and reporting',
        ],
      },
      commonQuestions: [
        {
          question: 'What is ABA therapy?',
          answer:
            'Applied Behavior Analysis (ABA) is a scientific approach to understanding and changing behavior. It focuses on teaching new skills and reducing challenging behaviors through positive reinforcement and evidence-based techniques.',
        },
        {
          question: 'How long does ABA therapy typically last?',
          answer:
            'ABA therapy duration varies based on individual needs. Most children receive 10-40 hours per week of therapy. The length of treatment depends on the child\'s progress and goals, typically ranging from several months to a few years.',
        },
        {
          question: 'What age groups do you serve?',
          answer:
            'We provide ABA therapy services for children ages 18 months to 18 years. Early intervention is most effective, but we work with individuals of all ages within this range.',
        },
        {
          question: 'Is ABA therapy covered by insurance?',
          answer:
            'Yes, many insurance plans cover ABA therapy. We accept most major insurance providers including private insurance, Medicaid, and regional center funding. Our team can help verify your coverage and benefits.',
        },
        {
          question: 'What qualifications do your therapists have?',
          answer:
            'Our team includes Board Certified Behavior Analysts (BCBAs) who oversee treatment plans and Registered Behavior Technicians (RBTs) who provide direct therapy. All staff are trained and certified in ABA principles and techniques.',
        },
        {
          question: 'Where does therapy take place?',
          answer:
            'We offer flexible therapy locations including our clinic, your home, school, or community settings. The location is determined based on your child\'s needs and treatment goals.',
        },
        {
          question: 'How do I get started?',
          answer:
            'Getting started is easy! First, contact us to schedule an initial consultation. We\'ll conduct a comprehensive assessment of your child, develop an individualized treatment plan, and work with your insurance to begin services.',
        },
        {
          question: 'What can I expect in the first session?',
          answer:
            'The first session typically involves a comprehensive assessment where our BCBA observes your child, gathers information about their strengths and challenges, and discusses your goals. This helps us create a personalized treatment plan.',
        },
        {
          question: 'How will I know if my child is making progress?',
          answer:
            'We track progress through regular data collection during each session. You\'ll receive detailed progress reports showing your child\'s achievements, and we hold regular meetings to review goals and adjust treatment as needed.',
        },
        {
          question: 'Can parents be involved in therapy?',
          answer:
            'Absolutely! Parent involvement is crucial for success. We provide parent training to help you implement strategies at home, and we encourage you to participate in sessions and ask questions.',
        },
      ],
      therapyAreas: [
        {
          area: 'Communication Skills',
          description:
            'Teaching verbal and non-verbal communication, including requesting, labeling, and conversational skills.',
        },
        {
          area: 'Social Skills',
          description:
            'Developing peer interactions, sharing, turn-taking, and appropriate social behaviors.',
        },
        {
          area: 'Daily Living Skills',
          description:
            'Building independence in self-care, hygiene, dressing, and other essential life skills.',
        },
        {
          area: 'Academic Skills',
          description:
            'Supporting learning readiness, following instructions, and academic concepts.',
        },
        {
          area: 'Behavior Reduction',
          description:
            'Addressing challenging behaviors through functional assessment and positive behavior support.',
        },
        {
          area: 'Play Skills',
          description:
            'Teaching appropriate play with toys, imaginative play, and recreational activities.',
        },
      ],
      contactInfo: {
        phone: '1-800-ABA-HELP',
        email: 'info@abaconnect.com',
        hours: 'Monday-Friday: 8:00 AM - 6:00 PM',
        emergencyLine: 'Available 24/7 for current clients',
      },
    }

    return response.json(knowledgeBase)
  }

  /**
   * Get parent context (view knowledge base)
   * GET /api/liveavatar/context/:parent_id
   */
  async getParentContext({ params, auth, response }: HttpContext) {
    try {
      const parentId = parseInt(params.parent_id)

      // Security check: user must be the parent or an admin
      if (auth.user) {
        const isAuthorized =
          auth.user.id === parentId || auth.user.role === 'ADMIN'

        if (!isAuthorized) {
          return response.status(403).json({
            error: 'Unauthorized',
          })
        }
      } else {
        return response.status(401).json({
          error: 'Authentication required',
        })
      }

      // Validate parent exists
      const parent = await User.find(parentId)
      if (!parent) {
        return response.status(404).json({
          error: 'Parent not found',
        })
      }

      if (parent.role !== 'PARENT') {
        return response.status(400).json({
          error: 'Invalid parent ID',
        })
      }

      // Get parent context
      const context = await this.parentContextService.getParentContext(parentId)

      return response.json({
        parent_id: parentId,
        data: context.knowledge_base,
        cache_age: context.cache_age,
        last_updated: context.last_updated,
      })
    } catch (error: any) {
      console.error('Error fetching knowledge base:', error)
      return response.status(500).json({
        error: 'Failed to fetch knowledge base',
        details: error.message,
      })
    }
  }

  /**
   * Refresh parent context
   * POST /api/liveavatar/context/refresh
   */
  async refreshParentContext({ request, auth, response }: HttpContext) {
    try {
      const { parent_id } = request.only(['parent_id'])
      const parentId = parseInt(parent_id)

      // Security check: user must be the parent or an admin
      if (auth.user) {
        const isAuthorized =
          auth.user.id === parentId || auth.user.role === 'ADMIN'

        if (!isAuthorized) {
          return response.status(403).json({
            error: 'Unauthorized',
          })
        }
      } else {
        return response.status(401).json({
          error: 'Authentication required',
        })
      }

      // Validate parent exists
      const parent = await User.find(parentId)
      if (!parent) {
        return response.status(404).json({
          error: 'Parent not found',
        })
      }

      if (parent.role !== 'PARENT') {
        return response.status(400).json({
          error: 'Invalid parent ID',
        })
      }

      // Refresh context
      const context = await this.parentContextService.refreshContext(parentId)

      // Log refresh operation for auditing
      console.log(
        `Context refreshed for parent ${parentId} by user ${auth.user.id} at ${new Date().toISOString()}`
      )

      return response.json({
        success: true,
        parent_id: parentId,
        data: context.knowledge_base,
        last_updated: context.last_updated,
      })
    } catch (error: any) {
      console.error('Error refreshing context:', error)
      return response.status(500).json({
        error: 'Failed to refresh context',
        details: error.message,
      })
    }
  }

  /**
   * Debug endpoint to test parent context fetching
   * GET /api/liveavatar/debug/parent/:parent_id
   */
  async debugParentContext({ params, response }: HttpContext) {
    try {
      const parentId = parseInt(params.parent_id)

      console.log('=== DEBUG: Fetching parent context for parent_id:', parentId)

      // Get parent context
      const context = await this.parentContextService.getParentContext(parentId)

      console.log('=== DEBUG: Context fetched successfully')
      console.log('=== DEBUG: Children count:', context.knowledge_base.children_details.length)
      console.log('=== DEBUG: Sessions count:', context.knowledge_base.recent_activity.length)
      console.log('=== DEBUG: Goals count:', context.knowledge_base.treatment_goals.length)

      return response.json({
        parent_id: parentId,
        context: context,
        debug_info: {
          children_count: context.knowledge_base.children_details.length,
          sessions_count: context.knowledge_base.recent_activity.length,
          goals_count: context.knowledge_base.treatment_goals.length,
          progress_count: context.knowledge_base.progress_highlights.length,
        },
      })
    } catch (error: any) {
      console.error('=== DEBUG ERROR:', error)
      return response.status(500).json({
        error: 'Debug failed',
        details: error.message,
        stack: error.stack,
      })
    }
  }
}
