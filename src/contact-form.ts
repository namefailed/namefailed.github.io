/** Static-site contact form — delivers to inbox via FormSubmit (no backend). */

export const CONTACT_FORM_RECIPIENT = 'namefailedx@gmail.com'

const FORM_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_FORM_RECIPIENT}`

export type ContactFormVariant = 'wm' | 'plain'

export interface ContactFormPayload {
  name: string
  email: string
  message: string
}

export interface ContactFormSubmitResult {
  ok: boolean
  message: string
}

/** POST JSON payload to FormSubmit; used by the mounted form and tests. */
export async function submitContactForm(
  payload: ContactFormPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<ContactFormSubmitResult> {
  const response = await fetchImpl(FORM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim(),
      message: payload.message.trim(),
      _subject: 'mrgrey.site — contact form',
      _replyto: payload.email.trim(),
      _captcha: 'false',
    }),
  })

  let body: { success?: string; message?: string } | null = null
  try {
    body = (await response.json()) as { success?: string; message?: string }
  } catch {
    body = null
  }

  if (response.ok && body?.success === 'true') {
    return { ok: true, message: 'Message sent — I’ll get back to you soon.' }
  }

  const detail = body?.message?.trim()
  return {
    ok: false,
    message: detail
      ? `Could not send: ${detail}`
      : `Something went wrong. Email me directly at ${CONTACT_FORM_RECIPIENT}.`,
  }
}

function field(
  id: string,
  label: string,
  input: HTMLInputElement | HTMLTextAreaElement,
): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'contact-form-field'

  const labelEl = document.createElement('label')
  labelEl.className = 'contact-form-label'
  labelEl.htmlFor = id
  labelEl.textContent = label

  input.id = id
  input.name = id
  input.className = 'contact-form-control'
  input.required = true

  wrap.append(labelEl, input)
  return wrap
}

/** Build and wire the contact form (WM Contact tile + classic /static page). */
export function mountContactForm(variant: ContactFormVariant = 'wm'): HTMLFormElement {
  const form = document.createElement('form')
  form.className =
    variant === 'plain' ? 'contact-form contact-form--plain' : 'contact-form contact-form--wm'
  form.noValidate = true
  form.setAttribute('aria-label', 'Send a message')

  const heading = document.createElement('p')
  heading.className = 'contact-form-heading'
  heading.textContent = 'Send a message'

  const hint = document.createElement('p')
  hint.className = 'contact-form-hint'
  hint.textContent = 'Name, email, and a short note — delivered to my inbox.'

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.autocomplete = 'name'
  nameInput.maxLength = 120

  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.autocomplete = 'email'
  emailInput.inputMode = 'email'
  emailInput.maxLength = 254

  const messageInput = document.createElement('textarea')
  messageInput.rows = 4
  messageInput.maxLength = 4000

  const honey = document.createElement('input')
  honey.type = 'text'
  honey.name = '_honey'
  honey.tabIndex = -1
  honey.autocomplete = 'off'
  honey.setAttribute('aria-hidden', 'true')
  honey.className = 'contact-form-honey'

  const status = document.createElement('p')
  status.className = 'contact-form-status'
  status.hidden = true
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'contact-form-submit'
  submit.textContent = 'Send message'

  form.append(
    heading,
    hint,
    field('name', 'Name', nameInput),
    field('email', 'Email', emailInput),
    field('message', 'Message', messageInput),
    honey,
    status,
    submit,
  )

  form.addEventListener('submit', (event) => {
    void handleSubmit(event, form, status, submit, honey)
  })

  return form
}

async function handleSubmit(
  event: Event,
  form: HTMLFormElement,
  status: HTMLParagraphElement,
  submit: HTMLButtonElement,
  honey: HTMLInputElement,
): Promise<void> {
  event.preventDefault()

  if (honey.value.trim()) return

  if (!form.reportValidity()) return

  const payload: ContactFormPayload = {
    name: (form.elements.namedItem('name') as HTMLInputElement).value,
    email: (form.elements.namedItem('email') as HTMLInputElement).value,
    message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
  }

  submit.disabled = true
  status.hidden = false
  status.className = 'contact-form-status contact-form-status--pending'
  status.textContent = 'Sending…'

  try {
    const result = await submitContactForm(payload)
    status.className = result.ok
      ? 'contact-form-status contact-form-status--ok'
      : 'contact-form-status contact-form-status--err'
    status.textContent = result.message
    if (result.ok) form.reset()
  } catch {
    status.className = 'contact-form-status contact-form-status--err'
    status.textContent = `Network error — try ${CONTACT_FORM_RECIPIENT} directly.`
  } finally {
    submit.disabled = false
  }
}
