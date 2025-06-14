import { NextRequest } from 'next/server'
import { GET } from '@/app/(bifrost)/bifrost/events/actions'
import { createTestClient, createTestEvent, createTestCompany, createTestInternalMember, createTestEventOrganizer, cleanupTestData } from '../../helpers/db-utils'

// Mock the client import
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('/api/events integration tests', () => {
  let testEvent: any
  let testCompany: any
  let testMember: any
  let testOrganizer: any

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData()
    
    // Create test data
    testCompany = await createTestCompany({
      name: 'Integration Test Company',
      description: 'Company for integration testing',
    })

    testEvent = await createTestEvent({
      title: 'Integration Test Event',
      teaser: 'Event for integration testing',
      hosting_company: testCompany.id,
      event_date: '2024-12-31T16:00:00Z',
      registration_date: '2024-12-01T12:00:00Z',
    })

    testMember = await createTestInternalMember({
      navet_email: 'test.organizer@navet.no',
      position: 'Test Organizer',
    })

    testOrganizer = await createTestEventOrganizer({
      event: testEvent.id,
      navet_member: testMember.id,
      type: 'Hovedansvarlig',
    })
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('getEvents', () => {
    it('should fetch events for current semester by default', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          overrideTypes: jest.fn().mockResolvedValue({
            data: [
              {
                id: testEvent.id,
                title: testEvent.title,
                teaser: testEvent.teaser,
                event_date: testEvent.event_date,
                registration_date: testEvent.registration_date,
                company: {
                  name: testCompany.name,
                  description: testCompany.description,
                },
              },
            ],
            error: null,
          }),
        })),
      }

      // Mock the organizers query
      mockClient.from = jest.fn((table) => {
        if (table === 'event') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            overrideTypes: jest.fn().mockResolvedValue({
              data: [
                {
                  id: testEvent.id,
                  title: testEvent.title,
                  teaser: testEvent.teaser,
                  event_date: testEvent.event_date,
                  registration_date: testEvent.registration_date,
                  company: {
                    name: testCompany.name,
                    description: testCompany.description,
                  },
                },
              ],
              error: null,
            }),
          }
        }
        if (table === 'event_organizers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            overrideTypes: jest.fn().mockResolvedValue({
              data: [
                {
                  id: testOrganizer.id,
                  type: testOrganizer.type,
                  event: testEvent.id,
                  internal_member: {
                    navet_member: testMember.id,
                    user: {
                      id: testMember.id,
                      firstname: 'Test',
                      lastname: 'Organizer',
                    },
                  },
                },
              ],
              error: null,
            }),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          overrideTypes: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      require('@/utils/supabase/client').createClient.mockReturnValue(mockClient)

      const { getEvents } = require('@/app/(bifrost)/bifrost/events/actions')
      const events = await getEvents()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        id: testEvent.id,
        title: testEvent.title,
        teaser: testEvent.teaser,
        company: {
          name: testCompany.name,
          description: testCompany.description,
        },
      })
      expect(events[0].organizers).toHaveLength(1)
      expect(events[0].organizers[0]).toMatchObject({
        id: testOrganizer.id,
        type: testOrganizer.type,
        firstname: 'Test',
        lastname: 'Organizer',
      })
    })

    it('should filter events by semester', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          overrideTypes: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        })),
      }

      require('@/utils/supabase/client').createClient.mockReturnValue(mockClient)

      const { getEvents } = require('@/app/(bifrost)/bifrost/events/actions')
      await getEvents('V24')

      const selectCall = mockClient.from().select
      const gteCall = mockClient.from().gte
      const lteCall = mockClient.from().lte

      expect(selectCall).toHaveBeenCalled()
      expect(gteCall).toHaveBeenCalledWith('event_date', '2024-01-01')
      expect(lteCall).toHaveBeenCalledWith('event_date', '2024-06-30')
    })

    it('should handle database errors gracefully', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          overrideTypes: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error', code: 'DB_ERROR' },
          }),
        })),
      }

      require('@/utils/supabase/client').createClient.mockReturnValue(mockClient)

      const { getEvents } = require('@/app/(bifrost)/bifrost/events/actions')
      
      await expect(getEvents()).rejects.toThrow('Database error')
    })
  })

  describe('getPossibleSemesters', () => {
    it('should return unique semesters from events', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          overrideTypes: jest.fn().mockResolvedValue({
            data: [
              { id: '1', event_date: new Date('2024-03-15') },
              { id: '2', event_date: new Date('2024-09-15') },
              { id: '3', event_date: new Date('2024-04-20') },
              { id: '4', event_date: new Date('2023-11-10') },
            ],
            error: null,
          }),
        })),
      }

      require('@/utils/supabase/client').createClient.mockReturnValue(mockClient)

      const { getPossibleSemesters } = require('@/app/(bifrost)/bifrost/events/actions')
      const semesters = await getPossibleSemesters()

      expect(semesters).toContain('V24') // Spring 2024
      expect(semesters).toContain('H24') // Fall 2024
      expect(semesters).toContain('H23') // Fall 2023
      expect(semesters).toHaveLength(3) // Should be unique
    })

    it('should handle events with invalid dates', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          overrideTypes: jest.fn().mockResolvedValue({
            data: [
              { id: '1', event_date: new Date('2024-03-15') },
              { id: '2', event_date: null },
              { id: '3', event_date: new Date('invalid-date') },
            ],
            error: null,
          }),
        })),
      }

      require('@/utils/supabase/client').createClient.mockReturnValue(mockClient)

      const { getPossibleSemesters } = require('@/app/(bifrost)/bifrost/events/actions')
      const semesters = await getPossibleSemesters()

      expect(semesters).toContain('V24')
      expect(semesters).toHaveLength(1) // Only valid dates should be included
    })

    it('should handle database errors in getPossibleSemesters', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          overrideTypes: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error', code: 'DB_ERROR' },
          }),
        })),
      }

      require('@/utils/supabase/client').createClient.mockReturnValue(mockClient)

      const { getPossibleSemesters } = require('@/app/(bifrost)/bifrost/events/actions')
      
      await expect(getPossibleSemesters()).rejects.toThrow('Database error')
    })
  })
})