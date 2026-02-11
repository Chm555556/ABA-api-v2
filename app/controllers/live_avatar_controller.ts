import type { HttpContext } from '@adonisjs/core/http'
import axios from 'axios'

export default class LiveAvatarController {
  /**
   * Create a LiveAvatar session token
   * This endpoint creates a session token for the LiveAvatar consultation
   */
  async createSessionToken({ response }: HttpContext) {
    try {
      const apiKey = process.env.LIVEAVATAR_API_KEY

      if (!apiKey) {
        return response.status(500).json({
          error: 'LiveAvatar API key not configured',
        })
      }

      // Create session token with LiveAvatar API
      const sessionResponse = await axios.post(
        'https://api.liveavatar.com/v1/sessions/token',
        {
          mode: 'FULL',
          avatar_id: process.env.LIVEAVATAR_AVATAR_ID || 'default_avatar',
          avatar_persona: {
            voice_id: process.env.LIVEAVATAR_VOICE_ID || 'default_voice',
            context_id: process.env.LIVEAVATAR_CONTEXT_ID || 'default_context',
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

      console.log('session ---> ', sessionResponse.data)

      return response.json({
        session_id: sessionResponse.data.data.session_id,
        session_token: sessionResponse.data.data.session_token,
      })
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
}
