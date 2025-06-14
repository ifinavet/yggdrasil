import { http, HttpResponse } from 'msw'

export const handlers = [
  // Auth endpoints
  http.post('/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
          firstname: 'Test',
          lastname: 'User',
        },
      },
    })
  }),

  http.get('/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: {
        firstname: 'Test',
        lastname: 'User',
      },
    })
  }),

  http.post('/auth/v1/signup', () => {
    return HttpResponse.json({
      user: {
        id: 'new-user-id',
        email: 'newuser@example.com',
      },
    })
  }),

  http.post('/auth/v1/logout', () => {
    return HttpResponse.json({})
  }),

  // Database endpoints
  http.get('/rest/v1/event', ({ request }) => {
    const url = new URL(request.url)
    const select = url.searchParams.get('select')
    
    const mockEvents = [
      {
        id: 1,
        title: 'Test Event 1',
        teaser: 'Test teaser 1',
        event_date: '2024-12-31T16:00:00Z',
        registration_date: '2024-12-01T12:00:00Z',
        company: {
          name: 'Test Company',
          description: 'Test Description',
        },
      },
      {
        id: 2,
        title: 'Test Event 2',
        teaser: 'Test teaser 2',
        event_date: '2024-11-30T17:00:00Z',
        registration_date: '2024-11-01T12:00:00Z',
        company: {
          name: 'Another Company',
          description: 'Another Description',
        },
      },
    ]

    return HttpResponse.json(mockEvents)
  }),

  http.post('/rest/v1/event', () => {
    return HttpResponse.json({
      id: 3,
      title: 'New Event',
      description: 'New Event Description',
    })
  }),

  http.get('/rest/v1/company', () => {
    return HttpResponse.json([
      {
        id: 'company-1',
        name: 'Test Company',
        description: 'Test Company Description',
        logo: 'logo-1',
      },
      {
        id: 'company-2',
        name: 'Another Company',
        description: 'Another Company Description',
        logo: 'logo-2',
      },
    ])
  }),

  http.get('/rest/v1/internal_member', () => {
    return HttpResponse.json([
      {
        id: 'member-1',
        user: {
          id: 'user-1',
          firstname: 'John',
          lastname: 'Doe',
        },
      },
      {
        id: 'member-2',
        user: {
          id: 'user-2',
          firstname: 'Jane',
          lastname: 'Smith',
        },
      },
    ])
  }),

  http.get('/rest/v1/event_organizers', () => {
    return HttpResponse.json([
      {
        id: 1,
        type: 'Hovedansvarlig',
        event: 1,
        internal_member: {
          navet_member: 1,
          user: {
            id: 'user-1',
            firstname: 'John',
            lastname: 'Doe',
          },
        },
      },
    ])
  }),

  http.post('/rest/v1/event_organizers', () => {
    return HttpResponse.json([
      {
        id: 2,
        event: 1,
        navet_member: 'member-1',
        type: 'Ansvarlig',
      },
    ])
  }),

  // Storage endpoints
  http.post('/storage/v1/object/sign/:bucket/*', () => {
    return HttpResponse.json({
      signedURL: 'https://example.com/signed-url',
    })
  }),

  // Profile image endpoint
  http.get('/api/set-profile-image/route', () => {
    return HttpResponse.json({ success: true })
  }),

  // Error scenarios
  http.get('/rest/v1/error-test', () => {
    return HttpResponse.json(
      { error: 'Test error', message: 'This is a test error' },
      { status: 500 }
    )
  }),

  // Fallback for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return HttpResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
  }),
]