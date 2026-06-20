// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * `src/main.ts` is the Vite entry. It runs on import: calls `bootstrapShellUi()`
 * and, on rejection, appends a fixed `role="alert"` div reading
 * `Failed to start desktop: <msg>`. We control the bootstrap via a mock and
 * re-import the module fresh per test (vi.resetModules) so the import-time
 * side effect re-runs against the current mock. A microtask flush lets the
 * `.catch()` settle before we assert — no pending async survives to teardown.
 */

// Hoisted controllable mock for the one collaborator main.ts imports.
const bootstrapShellUi = vi.fn<() => Promise<void>>()
vi.mock('./bootstrap-shell', () => ({ bootstrapShellUi }))

// Silence the diagnostic console.error in the rejection path (still assert it fired).
let errorSpy: ReturnType<typeof vi.spyOn>

/** Resolve after the queued microtasks so the bootstrap promise + its catch settle. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  document.body.innerHTML = ''
  bootstrapShellUi.mockReset()
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  document.body.innerHTML = ''
})

describe('main entry', () => {
  it('boots the shell and renders no error alert when bootstrap resolves', async () => {
    bootstrapShellUi.mockResolvedValue(undefined)

    await import('./main')
    await flushMicrotasks()

    expect(bootstrapShellUi).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('renders a fixed error alert with the Error message when bootstrap rejects', async () => {
    bootstrapShellUi.mockRejectedValue(new Error('boom: disk on fire'))

    await import('./main')
    await flushMicrotasks()

    expect(bootstrapShellUi).toHaveBeenCalledTimes(1)

    const alert = document.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.tagName).toBe('DIV')
    expect(alert?.textContent).toBe('Failed to start desktop: boom: disk on fire')
    // Appended to <body>, fixed full-screen overlay.
    expect(alert?.parentElement).toBe(document.body)
    expect((alert as HTMLElement).style.position).toBe('fixed')
    expect((alert as HTMLElement).style.zIndex).toBe('99999')

    // Diagnostic logged with the prefix and the raw error.
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][0]).toBe('[main] bootstrap failed:')
  })

  it('stringifies a non-Error rejection value into the alert message', async () => {
    // Exercises the `String(err)` branch of the `err instanceof Error` ternary.
    bootstrapShellUi.mockRejectedValue('plain string failure')

    await import('./main')
    await flushMicrotasks()

    const alert = document.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toBe('Failed to start desktop: plain string failure')
  })
})
