import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SendManualUpdateModal } from '@/components/ui/send-manual-update-modal'

describe('SendManualUpdateModal', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, notified: 1 }), { status: 200 })
    )
  })
  afterEach(() => vi.restoreAllMocks())

  it('disables send when ticker is empty for buy/sell', () => {
    render(
      <SendManualUpdateModal
        open
        portfolioId="p1"
        portfolioName="Test Portfolio"
        onClose={() => {}}
      />
    )
    const sendButton = screen.getByText('send to doplers')
    expect(sendButton).toBeDisabled()
  })

  it('enables send once a ticker is entered', () => {
    render(
      <SendManualUpdateModal open portfolioId="p1" portfolioName="P" onClose={() => {}} />
    )
    const input = screen.getByPlaceholderText(/ticker/i)
    fireEvent.change(input, { target: { value: 'AAPL' } })
    const sendButton = screen.getByText('send to doplers')
    expect(sendButton).not.toBeDisabled()
  })

  it('POSTs the expected payload on submit', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, notified: 1 }), { status: 200 })
    )
    render(
      <SendManualUpdateModal open portfolioId="p1" portfolioName="P" onClose={() => {}} />
    )
    fireEvent.change(screen.getByPlaceholderText(/ticker/i), {
      target: { value: 'TSLA' },
    })
    fireEvent.click(screen.getByText('send to doplers'))
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/portfolios/notify',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"type":"buy"'),
        })
      )
    })
    await waitFor(() => {
      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.meta).toEqual({ manual: true });
    })
  })
})
