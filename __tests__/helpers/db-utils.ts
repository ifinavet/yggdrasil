import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/database.types'

// Test database configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

// Create admin client for testing
export const createTestClient = () => {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Clean up test data
export const cleanupTestData = async () => {
  const supabase = createTestClient()
  
  try {
    // Delete in reverse order of dependencies
    await supabase.from('attendees').delete().neq('id', '')
    await supabase.from('event_organizers').delete().neq('id', 0)
    await supabase.from('event').delete().neq('id', 0)
    await supabase.from('job_listing').delete().neq('id', '')
    await supabase.from('point').delete().neq('id', '')
    await supabase.from('internal_member').delete().neq('id', '')
    await supabase.from('student').delete().neq('id', '')
    await supabase.from('company').delete().neq('id', '')
    await supabase.from('user').delete().neq('id', '')
  } catch (error) {
    console.warn('Error cleaning up test data:', error)
  }
}

// Create test user
export const createTestUser = async (userData?: Partial<any>) => {
  const supabase = createTestClient()
  
  const defaultUser = {
    id: 'test-user-' + Date.now(),
    firstname: 'Test',
    lastname: 'User',
    ...userData,
  }
  
  const { data, error } = await supabase
    .from('user')
    .insert(defaultUser)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Create test company
export const createTestCompany = async (companyData?: Partial<any>) => {
  const supabase = createTestClient()
  
  const defaultCompany = {
    id: 'test-company-' + Date.now(),
    name: 'Test Company',
    description: 'Test Company Description',
    logo: 'test-logo',
    ...companyData,
  }
  
  const { data, error } = await supabase
    .from('company')
    .insert(defaultCompany)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Create test event
export const createTestEvent = async (eventData?: Partial<any>) => {
  const supabase = createTestClient()
  
  // Create company first if not provided
  let hostingCompany = eventData?.hosting_company
  if (!hostingCompany) {
    const company = await createTestCompany()
    hostingCompany = company.id
  }
  
  const defaultEvent = {
    title: 'Test Event',
    description: 'Test Event Description',
    teaser: 'Test teaser',
    event_date: '2024-12-31T16:00:00Z',
    registration_date: '2024-12-01T12:00:00Z',
    location: 'Test Location',
    food: 'Test Food',
    language: 'Norsk',
    age_restriction: '18+',
    participation_limit: 40,
    event_type: 'internal_event',
    hosting_company: hostingCompany,
    ...eventData,
  }
  
  const { data, error } = await supabase
    .from('event')
    .insert(defaultEvent)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Create test internal member
export const createTestInternalMember = async (memberData?: Partial<any>) => {
  const supabase = createTestClient()
  
  // Create user first if not provided
  let userId = memberData?.id
  if (!userId) {
    const user = await createTestUser()
    userId = user.id
  }
  
  const defaultMember = {
    id: userId,
    navet_email: 'test@navet.no',
    position: 'Test Position',
    group: 'Test Group',
    permissions: null,
    profile_image_id: null,
    ...memberData,
  }
  
  const { data, error } = await supabase
    .from('internal_member')
    .insert(defaultMember)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Create test student
export const createTestStudent = async (studentData?: Partial<any>) => {
  const supabase = createTestClient()
  
  // Create user first if not provided
  let userId = studentData?.id
  if (!userId) {
    const user = await createTestUser()
    userId = user.id
  }
  
  const defaultStudent = {
    id: userId,
    study_programme: 'Informatikk',
    year: 3,
    prefered_language: 'Norsk',
    ...studentData,
  }
  
  const { data, error } = await supabase
    .from('student')
    .insert(defaultStudent)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Create test event organizer
export const createTestEventOrganizer = async (organizerData?: Partial<any>) => {
  const supabase = createTestClient()
  
  // Create event and member if not provided
  let eventId = organizerData?.event
  let memberId = organizerData?.navet_member
  
  if (!eventId) {
    const event = await createTestEvent()
    eventId = event.id
  }
  
  if (!memberId) {
    const member = await createTestInternalMember()
    memberId = member.id
  }
  
  const defaultOrganizer = {
    event: eventId,
    navet_member: memberId,
    type: 'Ansvarlig',
    ...organizerData,
  }
  
  const { data, error } = await supabase
    .from('event_organizers')
    .insert(defaultOrganizer)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Create test attendee
export const createTestAttendee = async (attendeeData?: Partial<any>) => {
  const supabase = createTestClient()
  
  // Create event and student if not provided
  let eventId = attendeeData?.event
  let studentId = attendeeData?.student
  
  if (!eventId) {
    const event = await createTestEvent()
    eventId = event.id
  }
  
  if (!studentId) {
    const student = await createTestStudent()
    studentId = student.id
  }
  
  const defaultAttendee = {
    id: 'test-attendee-' + Date.now(),
    event: eventId,
    student: studentId,
    status: 'confirmed',
    dietary_restrictions: null,
    ...attendeeData,
  }
  
  const { data, error } = await supabase
    .from('attendees')
    .insert(defaultAttendee)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Create test job listing
export const createTestJobListing = async (jobData?: Partial<any>) => {
  const supabase = createTestClient()
  
  // Create company if not provided
  let companyId = jobData?.company
  if (!companyId) {
    const company = await createTestCompany()
    companyId = company.id
  }
  
  const defaultJob = {
    id: 'test-job-' + Date.now(),
    company: companyId,
    deadline: '2024-12-31',
    job_type: 'Sommerjobb',
    teaser: 'Test job teaser',
    description: 'Test job description',
    application_url: 'https://example.com/apply',
    ...jobData,
  }
  
  const { data, error } = await supabase
    .from('job_listing')
    .insert(defaultJob)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Database assertion helpers
export const expectDatabaseToContain = async (
  table: string,
  condition: Record<string, any>
) => {
  const supabase = createTestClient()
  const { data, error } = await supabase
    .from(table)
    .select()
    .match(condition)
  
  if (error) throw error
  expect(data).toHaveLength(1)
  return data[0]
}

export const expectDatabaseToNotContain = async (
  table: string,
  condition: Record<string, any>
) => {
  const supabase = createTestClient()
  const { data, error } = await supabase
    .from(table)
    .select()
    .match(condition)
  
  if (error) throw error
  expect(data).toHaveLength(0)
}

// Mock database responses
export const mockDatabaseSelect = (data: any) => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null }),
  order: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  overrideTypes: jest.fn().mockReturnThis(),
})

export const mockDatabaseError = (message: string) => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({
    data: null,
    error: { message, code: 'MOCK_ERROR' }
  }),
  order: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  overrideTypes: jest.fn().mockReturnThis(),
})