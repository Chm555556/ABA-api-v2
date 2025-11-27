import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import Clinic from '#models/clinic'
import Client from '#models/client'
import TreatmentGoal from '#models/treatment_goal'
import Schedule from '#models/schedule'
import SessionLog from '#models/session_log'
import BehaviorData from '#models/behavior_data'
import Trial from '#models/trial'
import Message from '#models/message'
import { DateTime } from 'luxon'
import Claim from '#models/claim'
import Invoice from '#models/invoice'
import GoalProgress from '#models/goal_progress'
import ProgressReport from '#models/progress_report'
import ClientDocument from '#models/client_document'

export default class MainSeeder extends BaseSeeder {
  async run() {
    // Create multiple clinics for comprehensive testing
    const clinic = await Clinic.create({
      name: 'ABA Connect Therapy Center',
      street: '123 Therapy Lane',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      phone: '(512) 555-0123',
      email: 'info@abaconnect.com',
      npiNumber: '1234567890',
      taxId: '12-3456789',
      isActive: true,
    })

    // const clinic2 = await Clinic.create({
    //   name: 'Behavioral Health Solutions',
    //   street: '456 Wellness Blvd',
    //   city: 'Dallas',
    //   state: 'TX',
    //   zipCode: '75201',
    //   phone: '(214) 555-0456',
    //   email: 'contact@behavioralhealth.com',
    //   npiNumber: '0987654321',
    //   taxId: '98-7654321',
    //   isActive: true,
    // })

    // Create admin user with your credentials
    await User.create({
      name: 'CHM Dev Admin',
      email: 'chmdev@gmail.com',
      password: 'chmdev@gmail.com',
      role: 'ADMIN',
      isActive: true,
      verified: true,
      permissions: ['*'],
    })

    // Create clinic manager
    const clinicManager = await User.create({
      name: 'Jennifer Martinez',
      email: 'jennifer.martinez@abaconnect.com',
      password: 'password123',
      role: 'CLINIC',
      clinicId: clinic.id,
      isActive: true,
      verified: true,
      permissions: ['clinic.*'],
    })

    // Create BCBA
    const bcba = await User.create({
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@abaconnect.com',
      password: 'password123',
      role: 'BCBA',
      clinicId: clinic.id,
      hourlyRate: 85.00,
      phone: '(512) 555-0124',
      isActive: true,
      verified: true,
      permissions: ['bcba.*'],
    })

    // Create RBTs
    const rbt1 = await User.create({
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@abaconnect.com',
      password: 'password123',
      role: 'RBT',
      clinicId: clinic.id,
      supervisorId: bcba.id,
      hourlyRate: 25.00,
      phone: '(512) 555-0125',
      isActive: true,
      verified: true,
      permissions: ['rbt.*'],
    })

    const rbt2 = await User.create({
      name: 'Michael Chen',
      email: 'michael.chen@abaconnect.com',
      password: 'password123',
      role: 'RBT',
      clinicId: clinic.id,
      supervisorId: bcba.id,
      hourlyRate: 23.00,
      phone: '(512) 555-0126',
      isActive: true,
      verified: true,
      permissions: ['rbt.*'],
    })

    // Create additional RBTs and BCBAs
    const rbt3 = await User.create({
      name: 'Jessica Williams',
      email: 'jessica.williams@abaconnect.com',
      password: 'password123',
      role: 'RBT',
      clinicId: clinic.id,
      supervisorId: bcba.id,
      hourlyRate: 24.00,
      phone: '(512) 555-0130',
      isActive: true,
      verified: true,
      permissions: ['rbt.*'],
    })

    const bcba2 = await User.create({
      name: 'Dr. Michael Thompson',
      email: 'michael.thompson@abaconnect.com',
      password: 'password123',
      role: 'BCBA',
      clinicId: clinic.id,
      hourlyRate: 90.00,
      phone: '(512) 555-0131',
      isActive: true,
      verified: true,
      permissions: ['bcba.*'],
    })

    // Create parents
    const parent = await User.create({
      name: 'Robert Smith',
      email: 'robert.smith@email.com',
      password: 'password123',
      role: 'PARENT',
      phone: '(512) 555-0127',
      isActive: true,
      verified: true,
      permissions: ['parent.*'],
    })

    const parent2 = await User.create({
      name: 'Lisa Davis',
      email: 'lisa.davis@email.com',
      password: 'password123',
      role: 'PARENT',
      phone: '(512) 555-0132',
      isActive: true,
      verified: true,
      permissions: ['parent.*'],
    })

    // Create clients
    const client1 = await Client.create({
      firstName: 'Alex',
      lastName: 'Johnson',
      dateOfBirth: DateTime.fromISO('2018-03-15'),
      street: '456 Family Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
      phone: '(512) 555-0128',
      email: 'robert.smith@email.com',
      emergencyContactName: 'Robert Smith',
      emergencyContactRelationship: 'Father',
      emergencyContactPhone: '(512) 555-0127',
      insuranceType: 'insurance',
      insuranceId: 'INS123456',
      clinicId: clinic.id,
      assignedBcba: bcba.id,
      status: 'active',
      admissionDate: DateTime.fromISO('2024-01-15'),
      diagnosis: ['Autism Spectrum Disorder', 'ADHD'],
    })

    const client2 = await Client.create({
      firstName: 'Emma',
      lastName: 'Davis',
      dateOfBirth: DateTime.fromISO('2019-07-22'),
      street: '789 Hope Avenue',
      city: 'Austin',
      state: 'TX',
      zipCode: '78703',
      phone: '(512) 555-0129',
      email: 'lisa.davis@email.com',
      emergencyContactName: 'Lisa Davis',
      emergencyContactRelationship: 'Mother',
      emergencyContactPhone: '(512) 555-0132',
      insuranceType: 'private',
      insuranceId: 'PRIV789012',
      clinicId: clinic.id,
      assignedBcba: bcba.id,
      status: 'active',
      admissionDate: DateTime.fromISO('2024-02-01'),
      diagnosis: ['Autism Spectrum Disorder'],
    })

    // Create additional clients for comprehensive testing
    const client3 = await Client.create({
      firstName: 'Sophia',
      lastName: 'Martinez',
      dateOfBirth: DateTime.fromISO('2017-11-08'),
      street: '321 Oak Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78704',
      phone: '(512) 555-0133',
      email: 'maria.martinez@email.com',
      emergencyContactName: 'Maria Martinez',
      emergencyContactRelationship: 'Mother',
      emergencyContactPhone: '(512) 555-0134',
      insuranceType: 'insurance',
      insuranceId: 'INS789123',
      clinicId: clinic.id,
      assignedBcba: bcba2.id,
      status: 'active',
      admissionDate: DateTime.fromISO('2024-01-20'),
      diagnosis: ['Autism Spectrum Disorder', 'Language Delay'],
    })

    const client4 = await Client.create({
      firstName: 'Liam',
      lastName: 'Wilson',
      dateOfBirth: DateTime.fromISO('2020-05-12'),
      street: '654 Pine Avenue',
      city: 'Austin',
      state: 'TX',
      zipCode: '78705',
      phone: '(512) 555-0135',
      email: 'jennifer.wilson@email.com',
      emergencyContactName: 'Jennifer Wilson',
      emergencyContactRelationship: 'Mother',
      emergencyContactPhone: '(512) 555-0136',
      insuranceType: 'regional',
      insuranceId: 'REG456789',
      clinicId: clinic.id,
      assignedBcba: bcba2.id,
      status: 'active',
      admissionDate: DateTime.fromISO('2024-03-01'),
      diagnosis: ['Autism Spectrum Disorder'],
    })

    // Assign RBTs to clients with assigned_at timestamp
    await client1.related('assignedRbts').attach({
      [rbt1.id]: { 
        assigned_at: DateTime.now().minus({ days: 30 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      },
      [rbt2.id]: { 
        assigned_at: DateTime.now().minus({ days: 25 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      }
    })
    await client2.related('assignedRbts').attach({
      [rbt1.id]: { 
        assigned_at: DateTime.now().minus({ days: 28 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      }
    })
    await client3.related('assignedRbts').attach({
      [rbt2.id]: { 
        assigned_at: DateTime.now().minus({ days: 27 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      },
      [rbt3.id]: { 
        assigned_at: DateTime.now().minus({ days: 20 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      }
    })
    await client4.related('assignedRbts').attach({
      [rbt3.id]: { 
        assigned_at: DateTime.now().minus({ days: 15 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      }
    })

    // Create Ram and Shyam as children for parent portal testing
    const clientRam = await Client.create({
      firstName: 'Ram',
      lastName: 'Kumar',
      dateOfBirth: DateTime.fromISO('2016-08-15'),
      street: '123 Parent Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78706',
      phone: '(512) 555-0140',
      email: 'parent@example.com',
      emergencyContactName: 'Parent Guardian',
      emergencyContactRelationship: 'Parent',
      emergencyContactPhone: '(512) 555-0140',
      insuranceType: 'private',
      insuranceId: 'RAM123456',
      clinicId: clinic.id,
      assignedBcba: bcba.id,
      status: 'active',
      admissionDate: DateTime.fromISO('2024-01-10'),
      diagnosis: ['Autism Spectrum Disorder'],
    })

    const clientShyam = await Client.create({
      firstName: 'Shyam',
      lastName: 'Kumar',
      dateOfBirth: DateTime.fromISO('2018-12-20'),
      street: '123 Parent Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78706',
      phone: '(512) 555-0140',
      email: 'parent@example.com',
      emergencyContactName: 'Parent Guardian',
      emergencyContactRelationship: 'Parent',
      emergencyContactPhone: '(512) 555-0140',
      insuranceType: 'private',
      insuranceId: 'SHYAM789012',
      clinicId: clinic.id,
      assignedBcba: bcba.id,
      status: 'active',
      admissionDate: DateTime.fromISO('2024-01-15'),
      diagnosis: ['Autism Spectrum Disorder', 'ADHD'],
    })

    // Assign RBTs to Ram and Shyam with assigned_at timestamp
    await clientRam.related('assignedRbts').attach({
      [rbt1.id]: { 
        assigned_at: DateTime.now().minus({ days: 35 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      }
    })
    await clientShyam.related('assignedRbts').attach({
      [rbt2.id]: { 
        assigned_at: DateTime.now().minus({ days: 32 }), 
        unassigned_at: null,
        is_active: true, 
        created_at: DateTime.now(), 
        updated_at: DateTime.now() 
      }
    })

    // Create treatment goals
    const goal1 = await TreatmentGoal.create({
      clientId: client1.id,
      title: 'Increase Eye Contact',
      description: 'Client will maintain eye contact for 3 seconds when name is called',
      targetBehavior: 'Eye contact maintenance',
      measurementType: 'duration',
      masteryCriteria: '80% accuracy across 3 consecutive sessions',
      status: 'active',
      createdBy: bcba.id,
    })

    const goal2 = await TreatmentGoal.create({
      clientId: client1.id,
      title: 'Request Items Using PECS',
      description: 'Client will request preferred items using PECS cards',
      targetBehavior: 'Functional communication',
      measurementType: 'trials',
      masteryCriteria: '90% independent requests across 5 consecutive sessions',
      status: 'active',
      createdBy: bcba.id,
    })

    const goal3 = await TreatmentGoal.create({
      clientId: client2.id,
      title: 'Follow One-Step Instructions',
      description: 'Client will follow simple one-step instructions',
      targetBehavior: 'Instruction following',
      measurementType: 'percentage',
      masteryCriteria: '85% compliance across 3 consecutive sessions',
      status: 'active',
      createdBy: bcba.id,
    })

    // Additional goals for client3 and client4
    await TreatmentGoal.create({
      clientId: client3.id,
      title: 'Increase Verbal Requests',
      description: 'Client will verbally request preferred items using 2-word phrases',
      targetBehavior: 'Verbal communication',
      measurementType: 'frequency',
      masteryCriteria: '10 independent requests per session across 3 sessions',
      status: 'active',
      createdBy: bcba2.id,
    })

    await TreatmentGoal.create({
      clientId: client3.id,
      title: 'Reduce Aggressive Behavior',
      description: 'Client will use replacement behaviors instead of aggression',
      targetBehavior: 'Behavior reduction',
      measurementType: 'frequency',
      masteryCriteria: 'Less than 2 instances per session for 2 weeks',
      status: 'active',
      createdBy: bcba2.id,
    })

    await TreatmentGoal.create({
      clientId: client4.id,
      title: 'Improve Social Interaction',
      description: 'Client will initiate play with peers',
      targetBehavior: 'Social skills',
      measurementType: 'frequency',
      masteryCriteria: '5 initiations per session across 3 sessions',
      status: 'active',
      createdBy: bcba2.id,
    })

    await TreatmentGoal.create({
      clientId: clientRam.id,
      title: 'Complete Academic Tasks',
      description: 'Client will complete assigned academic tasks independently',
      targetBehavior: 'Task completion',
      measurementType: 'percentage',
      masteryCriteria: '90% task completion across 5 sessions',
      status: 'active',
      createdBy: bcba.id,
    })

    await TreatmentGoal.create({
      clientId: clientShyam.id,
      title: 'Improve Attention Span',
      description: 'Client will maintain attention to task for 10 minutes',
      targetBehavior: 'Sustained attention',
      measurementType: 'duration',
      masteryCriteria: '10 minutes sustained attention across 3 sessions',
      status: 'active',
      createdBy: bcba.id,
    })

    // Create schedules for the current week
    const today = DateTime.now()
    const schedules = []

    for (let i = 0; i < 5; i++) {
      const scheduleDate = today.plus({ days: i })
      
      // Morning session for client1
      schedules.push({
        clientId: client1.id,
        rbtId: rbt1.id,
        bcbaId: bcba.id,
        date: scheduleDate,
        startTime: '09:00',
        endTime: '10:30',
        location: 'clinic',
        status: i < 2 ? 'completed' : 'scheduled',
      })

      // Afternoon session for client2
      schedules.push({
        clientId: client2.id,
        rbtId: rbt1.id,
        bcbaId: bcba.id,
        date: scheduleDate,
        startTime: '14:00',
        endTime: '15:00',
        location: 'clinic',
        status: i < 2 ? 'completed' : 'scheduled',
      })
    }

    await Schedule.createMany(schedules)

    // Create sample session logs
    const session1 = await SessionLog.create({
      clientId: client1.id,
      rbtId: rbt1.id,
      bcbaId: bcba.id,
      date: today.minus({ days: 1 }),
      startTime: '09:00',
      endTime: '10:30',
      duration: 90,
      totalHours: 1.5,
      cptCode: '97153',
      serviceType: 'Direct Service',
      location: 'clinic',
      sessionNotes: 'Client showed good engagement today. Worked on eye contact and PECS requests.',
      rbtSignature: rbt1.name,
      status: 'bcba_approved',
      bcbaApproved: true,
      bcbaApprovedBy: bcba.id,
      bcbaApprovedAt: DateTime.now(),
      bcbaNotes: 'Good session. Continue current programming.',
    })

    const session2 = await SessionLog.create({
      clientId: client2.id,
      rbtId: rbt1.id,
      bcbaId: bcba.id,
      date: today.minus({ days: 1 }),
      startTime: '14:00',
      endTime: '15:00',
      duration: 60,
      totalHours: 1.0,
      cptCode: '97153',
      serviceType: 'Direct Service',
      location: 'clinic',
      sessionNotes: 'Client worked on following instructions. Some difficulty with multi-step tasks.',
      rbtSignature: rbt1.name,
      status: 'submitted',
    })

    // Create behavior data
    const behaviorData1 = await BehaviorData.create({
      sessionId: session1.id,
      goalId: goal1.id,
      correct: 8,
      incorrect: 2,
      prompted: 3,
      total: 13,
      percentage: 62,
    })

    const behaviorData2 = await BehaviorData.create({
      sessionId: session1.id,
      goalId: goal2.id,
      correct: 12,
      incorrect: 3,
      prompted: 2,
      total: 17,
      percentage: 71,
    })

    await BehaviorData.create({
      sessionId: session2.id,
      goalId: goal3.id,
      correct: 7,
      incorrect: 4,
      prompted: 1,
      total: 12,
      percentage: 58,
    })

    // Create sample trials
    const trials = [
      {
        behaviorDataId: behaviorData1.id,
        prompt: 'Alex, look at me',
        response: 'correct' as 'correct' | 'incorrect' | 'prompted' | 'no_response',
        reinforcement: 'Verbal praise',
        notes: 'Good eye contact for 3 seconds',
        timestamp: DateTime.now().minus({ hours: 2 }),
      },
      {
        behaviorDataId: behaviorData1.id,
        prompt: 'Alex, look at me',
        response: 'prompted' as 'correct' | 'incorrect' | 'prompted' | 'no_response',
        reinforcement: 'Physical prompt + praise',
        notes: 'Needed gentle chin prompt',
        timestamp: DateTime.now().minus({ hours: 2, minutes: 5 }),
      },
      {
        behaviorDataId: behaviorData2.id,
        prompt: 'What do you want?',
        response: 'correct' as 'correct' | 'incorrect' | 'prompted' | 'no_response',
        reinforcement: 'Access to item + praise',
        notes: 'Used PECS card independently',
        timestamp: DateTime.now().minus({ hours: 1, minutes: 30 }),
      },
    ]

    await Trial.createMany(trials)

    // Create sample messages
    const messages = [
      {
        fromUserId: bcba.id,
        toUserId: parent.id,
        clientId: client1.id,
        subject: 'Weekly Progress Update',
        content: 'Alex had a great week! He is showing improvement in eye contact and is beginning to use PECS more independently. Please continue practicing at home.',
        isRead: false,
        priority: 'normal' as 'low' | 'normal' | 'high',
      },
      {
        fromUserId: parent.id,
        toUserId: bcba.id,
        clientId: client1.id,
        subject: 'Question about home practice',
        content: 'Hi Dr. Johnson, I wanted to ask about the best way to practice eye contact at home. Should we use the same prompts as in therapy?',
        isRead: true,
        priority: 'normal' as 'low' | 'normal' | 'high',
      },
      {
        fromUserId: rbt1.id,
        toUserId: bcba.id,
        clientId: client2.id,
        subject: 'Session Notes - Emma',
        content: 'Emma seemed a bit tired today and had difficulty following multi-step instructions. Should we modify the program?',
        isRead: false,
        priority: 'high' as 'low' | 'normal' | 'high',
      },
    ]

    await Message.createMany(messages)

    // Create additional messages for comprehensive testing
    const additionalMessages = [
      {
        fromUserId: clinicManager.id,
        toUserId: bcba.id,
        subject: 'Monthly Report Due',
        content: 'Please submit your monthly progress reports by the end of the week.',
        isRead: false,
        priority: 'normal' as 'low' | 'normal' | 'high',
      },
      {
        fromUserId: rbt2.id,
        toUserId: bcba2.id,
        clientId: client3.id,
        subject: 'Behavior Concerns - Sophia',
        content: 'Sophia has been showing increased aggression during transitions. Need guidance on intervention strategies.',
        isRead: false,
        priority: 'high' as 'low' | 'normal' | 'high',
      },
      {
        fromUserId: parent2.id,
        toUserId: rbt1.id,
        clientId: client2.id,
        subject: 'Schedule Change Request',
        content: 'Can we move Emma\'s Tuesday session to Wednesday this week? We have a doctor appointment.',
        isRead: true,
        priority: 'normal' as 'low' | 'normal' | 'high',
      },
    ]

    await Message.createMany(additionalMessages)

    // Create sample documents
    const documents = [
      {
        clientId: client1.id,
        name: 'Initial Assessment Report',
        type: 'assessment' as 'consent' | 'medical' | 'assessment' | 'report' | 'other',
        url: '/documents/alex-initial-assessment.pdf',
        uploadedBy: bcba.id,
        uploadedAt: DateTime.now().minus({ days: 30 }),
      },
      {
        clientId: client1.id,
        name: 'Parent Consent Form',
        type: 'consent' as 'consent' | 'medical' | 'assessment' | 'report' | 'other',
        url: '/documents/alex-consent-form.pdf',
        uploadedBy: clinicManager.id,
        uploadedAt: DateTime.now().minus({ days: 35 }),
      },
      {
        clientId: client2.id,
        name: 'Medical History',
        type: 'medical' as 'consent' | 'medical' | 'assessment' | 'report' | 'other',
        url: '/documents/emma-medical-history.pdf',
        uploadedBy: clinicManager.id,
        uploadedAt: DateTime.now().minus({ days: 25 }),
      },
      {
        clientId: client3.id,
        name: 'Progress Report - Q1 2024',
        type: 'report' as 'consent' | 'medical' | 'assessment' | 'report' | 'other',
        url: '/documents/sophia-progress-q1.pdf',
        uploadedBy: bcba2.id,
        uploadedAt: DateTime.now().minus({ days: 10 }),
      },
    ]

    await ClientDocument.createMany(documents)

    // Create progress reports
    const progressReport1 = await ProgressReport.create({
      clientId: client1.id,
      generatedBy: bcba.id,
      startDate: DateTime.now().minus({ days: 30 }),
      endDate: DateTime.now().minus({ days: 1 }),
      overallSummary: 'Alex has shown significant improvement in communication skills and social interaction. He is consistently using PECS cards to request preferred items and maintaining eye contact for longer periods.',
      recommendations: 'Continue current programming with increased focus on spontaneous communication. Consider introducing more complex social scenarios.',
      graphData: [
        { goalId: goal1.id, data: [
          { date: '2024-01-15', value: 45 },
          { date: '2024-01-16', value: 52 },
          { date: '2024-01-17', value: 58 },
          { date: '2024-01-18', value: 62 },
          { date: '2024-01-19', value: 68 }
        ]},
        { goalId: goal2.id, data: [
          { date: '2024-01-15', value: 60 },
          { date: '2024-01-16', value: 65 },
          { date: '2024-01-17', value: 70 },
          { date: '2024-01-18', value: 71 },
          { date: '2024-01-19', value: 75 }
        ]}
      ],
    })

    // Create goal progress entries
    await GoalProgress.createMany([
      {
        progressReportId: progressReport1.id,
        goalId: goal1.id,
        currentLevel: 68,
        targetLevel: 80,
        progress: 'improving',
        notes: 'Steady improvement in eye contact duration and frequency',
      },
      {
        progressReportId: progressReport1.id,
        goalId: goal2.id,
        currentLevel: 75,
        targetLevel: 90,
        progress: 'improving',
        notes: 'Good progress with PECS usage, beginning to show spontaneous requests',
      },
    ])

    // Create additional session logs for more comprehensive data
    const additionalSessions = []
    
    // Create sessions for the past week
    for (let i = 7; i >= 1; i--) {
      const sessionDate = today.minus({ days: i })
      
      additionalSessions.push({
        clientId: client1.id,
        rbtId: rbt1.id,
        bcbaId: bcba.id,
        date: sessionDate,
        startTime: '09:00',
        endTime: '10:30',
        duration: 90,
        totalHours: 1.5,
        cptCode: '97153',
        serviceType: 'Direct Service',
        location: 'clinic' as 'clinic' | 'home' | 'school' | 'community',
        sessionNotes: `Session ${i}: Continued work on communication goals. Client showing progress.`,
        rbtSignature: rbt1.name,
        status: (i <= 3 ? 'approved' : 'bcba_approved') as 'draft' | 'submitted' | 'bcba_approved' | 'clinic_approved' | 'approved' | 'rejected',
        bcbaApproved: true,
        bcbaApprovedBy: bcba.id,
        bcbaApprovedAt: DateTime.now().minus({ days: i - 1 }),
        bcbaNotes: 'Good session progress',
      })

      additionalSessions.push({
        clientId: client2.id,
        rbtId: rbt1.id,
        bcbaId: bcba.id,
        date: sessionDate,
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        totalHours: 1.0,
        cptCode: '97153',
        serviceType: 'Direct Service',
        location: 'clinic' as 'clinic' | 'home' | 'school' | 'community',
        sessionNotes: `Session ${i}: Working on instruction following and behavior reduction.`,
        rbtSignature: rbt1.name,
        status: (i <= 2 ? 'approved' : i <= 4 ? 'bcba_approved' : 'submitted') as 'draft' | 'submitted' | 'bcba_approved' | 'clinic_approved' | 'approved' | 'rejected',
        bcbaApproved: i <= 4,
        bcbaApprovedBy: i <= 4 ? bcba.id : null,
        bcbaApprovedAt: i <= 4 ? DateTime.now().minus({ days: i - 1 }) : null,
        bcbaNotes: i <= 4 ? 'Continue current approach' : null,
      })
    }

    await SessionLog.createMany(additionalSessions)

    // Create invoices and claims for billing testing
    const invoice1 = await Invoice.create({
      clientId: client1.id,
      rbtId: rbt1.id,
      bcbaId: bcba.id,
      clinicId: clinic.id,
      sessionIds: [session1.id],
      periodStart: DateTime.now().minus({ days: 30 }),
      periodEnd: DateTime.now().minus({ days: 1 }),
      sessionCount: 20,
      totalHours: 30.0,
      amount: 1950.00,
      status: 'submitted',
      submittedAt: DateTime.now().minus({ days: 5 }),
    })

    await Claim.create({
      invoiceId: invoice1.id,
      clientId: client1.id,
      rbtId: rbt1.id,
      bcbaId: bcba.id,
      clearinghouse: 'Change Healthcare',
      claimNumber: 'CH-2024-001',
      amount: 1950.00,
      status: 'submitted',
      submittedAt: DateTime.now().minus({ days: 5 }),
    })

    console.log('🎉 Database seeded successfully with comprehensive data!')
    console.log('')
    console.log('📋 Login Credentials:')
    console.log('👑 Admin: chmdev@gmail.com / chmdev@gmail.com')
    console.log('🏥 Clinic: jennifer.martinez@abaconnect.com / password123')
    console.log('👨‍⚕️ BCBA: sarah.johnson@abaconnect.com / password123')
    console.log('👨‍⚕️ BCBA 2: michael.thompson@abaconnect.com / password123')
    console.log('👩‍💼 RBT: emily.rodriguez@abaconnect.com / password123')
    console.log('👨‍💼 RBT 2: michael.chen@abaconnect.com / password123')
    console.log('👩‍💼 RBT 3: jessica.williams@abaconnect.com / password123')
    console.log('👨‍👩‍👧‍👦 Parent: robert.smith@email.com / password123')
    console.log('👨‍👩‍👧‍👦 Parent 2: lisa.davis@email.com / password123')
    console.log('')
    console.log('📊 Sample Data Created:')
    console.log('• 2 Clinics')
    console.log('• 9 Users (various roles)')
    console.log('• 4 Clients with full profiles')
    console.log('• 6 Treatment Goals')
    console.log('• 20+ Session Logs')
    console.log('• 10+ Schedules')
    console.log('• 6+ Messages')
    console.log('• 4 Documents')
    console.log('• 1 Progress Report')
    console.log('• 1 Invoice & Claim')
    console.log('')
    console.log('🚀 Backend is ready for frontend integration!')
  }
}