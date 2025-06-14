import { render, screen } from '@testing-library/react'
import EventCard from '@/components/bifrost/events/event-card'
import { mockEvent } from '../../helpers/test-utils'

describe('EventCard', () => {
  it('should render event title and teaser', () => {
    render(<EventCard event={mockEvent} />)
    
    expect(screen.getByText(mockEvent.title)).toBeInTheDocument()
    expect(screen.getByText(mockEvent.teaser)).toBeInTheDocument()
  })

  it('should render company information', () => {
    render(<EventCard event={mockEvent} />)
    
    expect(screen.getByText('Bedrift:')).toBeInTheDocument()
    expect(screen.getByText(mockEvent.company.name)).toBeInTheDocument()
  })

  it('should render organizers section', () => {
    render(<EventCard event={mockEvent} />)
    
    expect(screen.getByText('Ansvarlige:')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Hovedansvarlig')).toBeInTheDocument()
  })

  it('should render multiple organizers', () => {
    const eventWithMultipleOrganizers = {
      ...mockEvent,
      organizers: [
        {
          id: 1,
          firstname: 'John',
          lastname: 'Doe',
          type: 'Hovedansvarlig',
        },
        {
          id: 2,
          firstname: 'Jane',
          lastname: 'Smith',
          type: 'Ansvarlig',
        },
      ],
    }

    render(<EventCard event={eventWithMultipleOrganizers} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Hovedansvarlig')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Ansvarlig')).toBeInTheDocument()
  })

  it('should handle event with no organizers', () => {
    const eventWithNoOrganizers = {
      ...mockEvent,
      organizers: [],
    }

    render(<EventCard event={eventWithNoOrganizers} />)
    
    expect(screen.getByText('Ansvarlige:')).toBeInTheDocument()
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  })

  it('should render card structure correctly', () => {
    render(<EventCard event={mockEvent} />)
    
    // Check for card structure
    const card = screen.getByRole('article', { hidden: true }) || screen.getByText(mockEvent.title).closest('div')
    expect(card).toBeInTheDocument()
  })

  it('should handle long event titles and teasers', () => {
    const eventWithLongContent = {
      ...mockEvent,
      title: 'This is a very long event title that should be displayed properly without breaking the layout',
      teaser: 'This is a very long teaser text that describes the event in great detail and should also be displayed properly without breaking the card layout',
    }

    render(<EventCard event={eventWithLongContent} />)
    
    expect(screen.getByText(eventWithLongContent.title)).toBeInTheDocument()
    expect(screen.getByText(eventWithLongContent.teaser)).toBeInTheDocument()
  })

  it('should handle organizers with missing names gracefully', () => {
    const eventWithIncompleteOrganizer = {
      ...mockEvent,
      organizers: [
        {
          id: 1,
          firstname: 'John',
          lastname: '',
          type: 'Hovedansvarlig',
        },
      ],
    }

    render(<EventCard event={eventWithIncompleteOrganizer} />)
    
    expect(screen.getByText('John')).toBeInTheDocument()
    expect(screen.getByText('Hovedansvarlig')).toBeInTheDocument()
  })
})