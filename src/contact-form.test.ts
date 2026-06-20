// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTACT_FORM_RECIPIENT, mountContactForm, submitContactForm } from './contact-form'

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

  it('falls back to the direct-email message when the response body is unparseable', async () => {
    // response.json() throwing exercises the catch that nulls out the body, then
    // the no-detail branch of the error message.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    })

    const result = await submitContactForm(
      { name: 'Ada', email: 'ada@example.com', message: 'Hi' },
      fetchMock,
    )

    expect(result.ok).toBe(false)
    expect(result.message).toBe(
      `Something went wrong. Email me directly at ${CONTACT_FORM_RECIPIENT}.`,
    )
  })

  it('trims each field before sending', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 'true' }),
    })

    await submitContactForm(
      { name: '  Ada  ', email: '  ada@example.com  ', message: '  Hello  ' },
      fetchMock,
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.name).toBe('Ada')
    expect(body.email).toBe('ada@example.com')
    expect(body.message).toBe('Hello')
    expect(body._subject).toBe('mrgrey.site — contact form')
    expect(body._captcha).toBe('false')
  })

  it('reports failure when ok is true but success is not "true"', async () => {
    // ok response with a non-"true" success flag must NOT be treated as sent.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 'false' }),
    })

    const result = await submitContactForm(
      { name: 'Ada', email: 'ada@example.com', message: 'Hi' },
      fetchMock,
    )

    expect(result.ok).toBe(false)
    expect(result.message).toBe(
      `Something went wrong. Email me directly at ${CONTACT_FORM_RECIPIENT}.`,
    )
  })
})

// --- mountContactForm + handleSubmit (DOM-driven) -----------------------------

describe('mountContactForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  /** A DOM input/textarea lookup helper scoped to a mounted form. */
  const ctrl = (form: HTMLFormElement, name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement
  const honeyOf = (form: HTMLFormElement) =>
    form.querySelector('.contact-form-honey') as HTMLInputElement
  const statusOf = (form: HTMLFormElement) =>
    form.querySelector('.contact-form-status') as HTMLParagraphElement
  const submitOf = (form: HTMLFormElement) =>
    form.querySelector('.contact-form-submit') as HTMLButtonElement

  /** Build a form, fill the three required fields, and mount it. */
  function mountFilled(values?: Partial<{ name: string; email: string; message: string }>) {
    const form = mountContactForm()
    document.body.appendChild(form)
    ;(ctrl(form, 'name') as HTMLInputElement).value = values?.name ?? 'Ada'
    ;(ctrl(form, 'email') as HTMLInputElement).value = values?.email ?? 'ada@example.com'
    ;(ctrl(form, 'message') as HTMLTextAreaElement).value = values?.message ?? 'Hello there'
    // Force reportValidity to true so we drive the submit path rather than the
    // browser's validity UI (happy-dom's constraint validation is partial).
    form.reportValidity = vi.fn(() => true)
    return form
  }

  /** Submit the form and flush the microtask queue so the async handler settles. */
  async function submitAndSettle(form: HTMLFormElement) {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    // Let the fire-and-forget handleSubmit promise (and its fetch) fully resolve.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  it('builds the wm variant with the three required fields and a hidden status', () => {
    const form = mountContactForm('wm')
    expect(form.classList.contains('contact-form--wm')).toBe(true)
    expect(form.noValidate).toBe(true)
    expect(form.getAttribute('aria-label')).toBe('Send a message')
    expect((ctrl(form, 'name') as HTMLInputElement).required).toBe(true)
    expect((ctrl(form, 'email') as HTMLInputElement).type).toBe('email')
    expect(ctrl(form, 'message').tagName).toBe('TEXTAREA')
    const status = statusOf(form)
    expect(status.hidden).toBe(true)
    expect(status.getAttribute('role')).toBe('status')
    expect(submitOf(form).textContent).toBe('Send message')
  })

  it('builds the plain variant with the plain modifier class', () => {
    const form = mountContactForm('plain')
    expect(form.classList.contains('contact-form--plain')).toBe(true)
    expect(form.classList.contains('contact-form--wm')).toBe(false)
  })

  it('defaults to the wm variant when no argument is given', () => {
    const form = mountContactForm()
    expect(form.classList.contains('contact-form--wm')).toBe(true)
  })

  it('submits the trimmed payload and shows the success state, then resets', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 'true' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const form = mountFilled({ name: 'Ada', email: 'ada@example.com', message: 'Hello there' })
    const status = statusOf(form)
    const submit = submitOf(form)

    await submitAndSettle(form)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://formsubmit.co/ajax/${CONTACT_FORM_RECIPIENT}`)
    const body = JSON.parse(String(init.body))
    expect(body.name).toBe('Ada')
    expect(body.email).toBe('ada@example.com')
    expect(body.message).toBe('Hello there')

    expect(status.hidden).toBe(false)
    expect(status.className).toBe('contact-form-status contact-form-status--ok')
    expect(status.textContent).toBe('Message sent — I’ll get back to you soon.')
    // Submit re-enabled in finally; form reset on success.
    expect(submit.disabled).toBe(false)
    expect((ctrl(form, 'name') as HTMLInputElement).value).toBe('')
    expect((ctrl(form, 'message') as HTMLTextAreaElement).value).toBe('')
  })

  it('shows the pending state before the request resolves', async () => {
    let release!: (v: unknown) => void
    const pending = new Promise((resolve) => {
      release = resolve
    })
    const fetchMock = vi.fn().mockReturnValue(pending)
    vi.stubGlobal('fetch', fetchMock)

    const form = mountFilled()
    const status = statusOf(form)
    const submit = submitOf(form)

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()

    // Mid-flight: disabled submit + pending status visible.
    expect(submit.disabled).toBe(true)
    expect(status.hidden).toBe(false)
    expect(status.className).toBe('contact-form-status contact-form-status--pending')
    expect(status.textContent).toBe('Sending…')

    // Settle so nothing is pending at teardown.
    release({ ok: true, json: async () => ({ success: 'true' }) })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(submit.disabled).toBe(false)
  })

  it('shows the error state and keeps the field values when the API rejects the message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: 'false', message: 'Invalid email' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const form = mountFilled({ name: 'Ada', email: 'bad', message: 'Hi there' })
    const status = statusOf(form)

    await submitAndSettle(form)

    expect(status.className).toBe('contact-form-status contact-form-status--err')
    expect(status.textContent).toBe('Could not send: Invalid email')
    // No reset on failure — the user keeps what they typed.
    expect((ctrl(form, 'name') as HTMLInputElement).value).toBe('Ada')
    expect(submitOf(form).disabled).toBe(false)
  })

  it('shows the network-error state when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const form = mountFilled()
    const status = statusOf(form)

    await submitAndSettle(form)

    expect(status.className).toBe('contact-form-status contact-form-status--err')
    expect(status.textContent).toBe(
      `Network error — try ${CONTACT_FORM_RECIPIENT} directly.`,
    )
    expect(submitOf(form).disabled).toBe(false)
  })

  it('ignores the submit entirely when the honeypot is filled (bot trap)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const form = mountFilled()
    honeyOf(form).value = 'http://spam.example'

    await submitAndSettle(form)

    expect(fetchMock).not.toHaveBeenCalled()
    // Status untouched: still hidden, no pending class applied.
    expect(statusOf(form).hidden).toBe(true)
    expect(submitOf(form).disabled).toBe(false)
  })

  it('does not submit when constraint validation fails (required fields empty)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const form = mountContactForm()
    document.body.appendChild(form)
    // Empty required fields -> reportValidity returns false -> early return.
    form.reportValidity = vi.fn(() => false)

    await submitAndSettle(form)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(statusOf(form).hidden).toBe(true)
    expect(submitOf(form).disabled).toBe(false)
  })

  it('prevents the form default navigation on submit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 'true' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const form = mountFilled()
    const event = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
})
