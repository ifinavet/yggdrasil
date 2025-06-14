import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  createTestClient,
  createTestEvent,
  createTestCompany,
  createTestInternalMember,
  createTestEventOrganizer,
  createTestAttendee,
  createTestStudent,
  cleanupTestData,
  expectDatabaseToContain,
  expectDatabaseToNotContain,
} from '../helpers/db-utils'

describe('Events Database Integration', () => {
  beforeEach(async () => {
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('Event CRUD Operations', () => {
    it('should create an event', async () => {
      const company = await createTestCompany()
      const event = await createTestEvent({
        title: 'Database Test Event',
        hosting_company: company.id,
      })

      expect(event.id).toBeDefined()
      expect(event.title).toBe('Database Test Event')
      expect(event.hosting_company).toBe(company.id)

      await expectDatabaseToContain('event', { id: event.id })
    })

    it('should read events with company data', async () => {
      const supabase = createTestClient()
      const company = await createTestCompany({ name: 'Test Read Company' })
      const event = await createTestEvent({
        title: 'Read Test Event',
        hosting_company: company.id,
      })

      const { data, error } = await supabase
        .from('event')
        .select(`
          *,
          company:hosting_company (
            id,
            name,
            description
          )
        `)
        .eq('id', event.id)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.title).toBe('Read Test Event')
      expect(data.company.name).toBe('Test Read Company')
    })

    it('should update an event', async () => {
      const event = await createTestEvent()
      const supabase = createTestClient()

      const { data, error } = await supabase
        .from('event')
        .update({ title: 'Updated Event Title' })
        .eq('id', event.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.title).toBe('Updated Event Title')

      await expectDatabaseToContain('event', {
        id: event.id,
        title: 'Updated Event Title',
      })
    })

    it('should delete an event', async () => {
      const event = await createTestEvent()
      const supabase = createTestClient()

      const { error } = await supabase
        .from('event')
        .delete()
        .eq('id', event.id)

      expect(error).toBeNull()

      await expectDatabaseToNotContain('event', { id: event.id })
    })
  })

  describe('Event Organizers', () => {
    it('should create event organizers', async () => {
      const event = await createTestEvent()
      const member = await createTestInternalMember()
      const organizer = await createTestEventOrganizer({
        event: event.id,
        navet_member: member.id,
        type: 'Hovedansvarlig',
      })

      expect(organizer.id).toBeDefined()
      expect(organizer.event).toBe(event.id)
      expect(organizer.navet_member).toBe(member.id)
      expect(organizer.type).toBe('Hovedansvarlig')

      await expectDatabaseToContain('event_organizers', { id: organizer.id })
    })

    it('should fetch organizers with user data', async () => {
      const event = await createTestEvent()
      const member = await createTestInternalMember()
      const organizer = await createTestEventOrganizer({
        event: event.id,
        navet_member: member.id,
      })

      const supabase = createTestClient()
      const { data, error } = await supabase
        .from('event_organizers')
        .select(`
          *,
          internal_member:navet_member (
            id,
            user (
              id,
              firstname,
              lastname
            )
          )
        `)
        .eq('event', event.id)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].internal_member.user.firstname).toBe('Test')
      expect(data[0].internal_member.user.lastname).toBe('User')
    })

    it('should enforce foreign key constraints', async () => {
      const supabase = createTestClient()

      // Try to create organizer with non-existent event
      const { error } = await supabase
        .from('event_organizers')
        .insert({
          event: 99999,
          navet_member: 'non-existent',
          type: 'Ansvarlig',
        })

      expect(error).toBeDefined()
      expect(error.code).toContain('foreign_key_violation')
    })
  })

  describe('Event Attendees', () => {
    it('should create attendees', async () => {
      const event = await createTestEvent()
      const student = await createTestStudent()
      const attendee = await createTestAttendee({
        event: event.id,
        student: student.id,
        status: 'confirmed',
      })

      expect(attendee.id).toBeDefined()
      expect(attendee.event).toBe(event.id)
      expect(attendee.student).toBe(student.id)
      expect(attendee.status).toBe('confirmed')

      await expectDatabaseToContain('attendees', { id: attendee.id })
    })

    it('should fetch attendees with student data', async () => {
      const event = await createTestEvent()
      const student = await createTestStudent()
      const attendee = await createTestAttendee({
        event: event.id,
        student: student.id,
      })

      const supabase = createTestClient()
      const { data, error } = await supabase
        .from('attendees')
        .select(`
          *,
          student (
            *,
            user (
              id,
              firstname,
              lastname
            )
          )
        `)
        .eq('event', event.id)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].student.user.firstname).toBe('Test')
      expect(data[0].student.study_programme).toBe('Informatikk')
    })

    it('should handle dietary restrictions', async () => {
      const event = await createTestEvent()
      const student = await createTestStudent()
      const attendee = await createTestAttendee({
        event: event.id,
        student: student.id,
        dietary_restrictions: 'Vegetarian, no nuts',
      })

      expect(attendee.dietary_restrictions).toBe('Vegetarian, no nuts')

      await expectDatabaseToContain('attendees', {
        id: attendee.id,
        dietary_restrictions: 'Vegetarian, no nuts',
      })
    })

    it('should prevent duplicate attendees for same event', async () => {
      const event = await createTestEvent()
      const student = await createTestStudent()
      
      // Create first attendee
      await createTestAttendee({
        event: event.id,
        student: student.id,
      })

      const supabase = createTestClient()

      // Try to create duplicate attendee
      const { error } = await supabase
        .from('attendees')
        .insert({
          event: event.id,
          student: student.id,
          status: 'confirmed',
        })

      expect(error).toBeDefined()
      expect(error.code).toContain('unique_violation')
    })
  })

  describe('Event Queries', () => {
    it('should filter events by date range', async () => {
      await createTestEvent({
        title: 'Spring Event',
        event_date: '2024-03-15T16:00:00Z',
      })
      await createTestEvent({
        title: 'Fall Event',
        event_date: '2024-09-15T16:00:00Z',
      })

      const supabase = createTestClient()
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .gte('event_date', '2024-01-01')
        .lte('event_date', '2024-06-30')

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].title).toBe('Spring Event')
    })

    it('should order events by date', async () => {
      await createTestEvent({
        title: 'Earlier Event',
        event_date: '2024-01-15T16:00:00Z',
      })
      await createTestEvent({
        title: 'Later Event',
        event_date: '2024-12-15T16:00:00Z',
      })

      const supabase = createTestClient()
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .order('event_date', { ascending: false })

      expect(error).toBeNull()
      expect(data).toHaveLength(2)
      expect(data[0].title).toBe('Later Event')
      expect(data[1].title).toBe('Earlier Event')
    })

    it('should filter events by type', async () => {
      await createTestEvent({
        title: 'Internal Event',
        event_type: 'internal_event',
      })
      await createTestEvent({
        title: 'External Event',
        event_type: 'external_event',
      })

      const supabase = createTestClient()
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .eq('event_type', 'internal_event')

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].title).toBe('Internal Event')
    })
  })

  describe('Database Constraints', () => {
    it('should enforce non-null constraints', async () => {
      const supabase = createTestClient()

      const { error } = await supabase
        .from('event')
        .insert({
          // Missing required fields like title
          event_date: '2024-12-31T16:00:00Z',
          event_type: 'internal_event',
        })

      expect(error).toBeDefined()
      expect(error.code).toContain('not_null_violation')
    })

    it('should enforce valid event types', async () => {
      const supabase = createTestClient()

      const { error } = await supabase
        .from('event')
        .insert({
          title: 'Invalid Event',
          event_date: '2024-12-31T16:00:00Z',
          event_type: 'invalid_type',
          participation_limit: 40,
        })

      expect(error).toBeDefined()
    })

    it('should enforce positive participation limits', async () => {
      const supabase = createTestClient()

      const { error } = await supabase
        .from('event')
        .insert({
          title: 'Negative Limit Event',
          event_date: '2024-12-31T16:00:00Z',
          event_type: 'internal_event',
          participation_limit: -10,
        })

      expect(error).toBeDefined()
    })
  })

  describe('Complex Queries', () => {
    it('should fetch events with all related data', async () => {
      const company = await createTestCompany({ name: 'Complex Query Company' })
      const event = await createTestEvent({
        title: 'Complex Event',
        hosting_company: company.id,
      })
      const member = await createTestInternalMember()
      const organizer = await createTestEventOrganizer({
        event: event.id,
        navet_member: member.id,
        type: 'Hovedansvarlig',
      })
      const student = await createTestStudent()
      const attendee = await createTestAttendee({
        event: event.id,
        student: student.id,
      })

      const supabase = createTestClient()
      const { data, error } = await supabase
        .from('event')
        .select(`
          *,
          company:hosting_company (
            id,
            name,
            description
          ),
          event_organizers (
            id,
            type,
            internal_member:navet_member (
              id,
              user (
                firstname,
                lastname
              )
            )
          ),
          attendees (
            id,
            status,
            student (
              id,
              study_programme
            )
          )
        `)
        .eq('id', event.id)
        .single()

      expect(error).toBeNull()
      expect(data.title).toBe('Complex Event')
      expect(data.company.name).toBe('Complex Query Company')
      expect(data.event_organizers).toHaveLength(1)
      expect(data.event_organizers[0].type).toBe('Hovedansvarlig')
      expect(data.attendees).toHaveLength(1)
      expect(data.attendees[0].student.study_programme).toBe('Informatikk')
    })
  })
})