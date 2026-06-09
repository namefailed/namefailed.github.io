import { describe, expect, it, vi } from 'vitest'
import { CONTACT_FORM_RECIPIENT, submitContactForm } from './contact-form'

describe('submitContactForm', () => {
  it('posts JSON to FormSubmit and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 'true', message: 'Thanks' }),
    })

    const result = await submitContactForm(
      { name: 'Ada', email: 'ada@example.com', message: 'Hello' },
      fetchMock,
    )

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://formsubmit.co/ajax/${CONTACT_FORM_RECIPIENT}`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }),
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.name).toBe('Ada')
    expect(body.email).toBe('ada@example.com')
    expect(body.message).toBe('Hello')
    expect(body._replyto).toBe('ada@example.com')
  })

  it('surfaces API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: 'false', message: 'Invalid email' }),
    })

    const result = await submitContactForm(
      { name: 'Ada', email: 'bad', message: 'Hi' },
      fetchMock,
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain('Invalid email')
  })
})
