import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from './helpers'
import SchedulePage from '../pages/SchedulePage'
import type { CronJob } from '../types'

// Issue #6495: an agent-less cron job resolves the CURRENT default agent at run
// time, so the accurate row label is the resolved alias, not the literal
// 'default'. Both the visible cell and the column tooltip must agree, and the
// literal 'default' must still render while the roster has not loaded.

const mkJob = (overrides: Partial<CronJob> = {}): CronJob => ({
  id: 'job-1',
  name: 'Nightly report',
  schedule: 'every 1d',
  message: 'send report',
  enabled: true,
  ...overrides,
} as CronJob)

vi.mock('../api/client', () => ({
  api: {
    crons: vi.fn(),
    cronFolders: vi.fn().mockResolvedValue([]),
    deleteCron: vi.fn(),
    batchDeleteCron: vi.fn(),
    createCron: vi.fn().mockResolvedValue({}),
    models: vi.fn().mockResolvedValue([]),
    updateCron: vi.fn().mockResolvedValue({}),
    toggleCron: vi.fn().mockResolvedValue({}),
    runCron: vi.fn().mockResolvedValue({}),
    cronToChat: vi.fn().mockResolvedValue({}),
    cronHistoryAll: vi.fn().mockResolvedValue({ runs: [] }),
    kirocrewAgents: vi.fn(),
    syncKirocrewAgents: vi.fn().mockResolvedValue({}),
  },
}))

describe('SchedulePage agent-less cron row label (#6495)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the resolved default alias in the cell and its tooltip', async () => {
    const { api } = await import('../api/client')
    vi.mocked(api).crons.mockResolvedValue({ jobs: [mkJob()] })
    vi.mocked(api).kirocrewAgents.mockResolvedValue({ agents: [], default_agent: 'atlas' })

    renderWithProviders(<SchedulePage />)

    const alias = await screen.findByText('atlas')
    expect(alias).toBeInTheDocument()
    // The tooltip lives on the enclosing TableCell's title attribute.
    expect(alias.closest('td')?.getAttribute('title')).toContain('atlas')
    expect(alias.closest('td')).not.toHaveTextContent('default')
  })

  it('keeps a pinned agent untouched by the resolved default', async () => {
    const { api } = await import('../api/client')
    // The agent-less control row in the same table proves the resolved
    // default has FLUSHED into the page before the pinned row is asserted —
    // without it this would pass on a render that never applied the fetch.
    vi.mocked(api).crons.mockResolvedValue({
      jobs: [mkJob({ agent: 'coder' }), mkJob({ id: 'job-2', name: 'Legacy job' })],
    })
    vi.mocked(api).kirocrewAgents.mockResolvedValue({ agents: [], default_agent: 'atlas' })

    renderWithProviders(<SchedulePage />)

    const control = await screen.findByText('atlas')
    expect(control.closest('td')?.getAttribute('title')).toContain('atlas')
    const pinned = screen.getByText('coder')
    expect(pinned.closest('td')?.getAttribute('title')).toContain('coder')
  })

  it("renders the literal 'default' while the roster has not loaded", async () => {
    const { api } = await import('../api/client')
    vi.mocked(api).crons.mockResolvedValue({ jobs: [mkJob()] })
    // Never resolves: the pre-load frame is the state under test.
    vi.mocked(api).kirocrewAgents.mockReturnValue(new Promise(() => {}))

    renderWithProviders(<SchedulePage />)

    const literal = await screen.findByText('default')
    expect(literal.closest('td')?.getAttribute('title')).toContain('default')
  })
})
