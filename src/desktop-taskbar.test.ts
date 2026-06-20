// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MinimizedEntry, TiledWin } from './desktop-open-window'

// Neutralise the lazy-import prefetch wiring so building dock buttons never kicks
// off a dynamic import() that would still be resolving at teardown. The real
// PINNED_DOCK_CMDS / LAUNCHER_ICON_ROWS constants are preserved so glyph + label
// + dock-membership logic stays under test.
vi.mock('./launcher-catalog', async () => {
  const actual = await vi.importActual<typeof import('./launcher-catalog')>('./launcher-catalog')
  return { ...actual, attachLazyPrefetchHandlers: vi.fn() }
})

import {
  buildTaskbarDockSnapshot,
  extraDockCommands,
  focusedTitleLabel,
  orderedDockCommands,
  renderTaskbarDock,
  resolveDockWindows,
  syncDockAutoHide,
  syncYasbFocusedTitle,
  taskbarIconMeta,
  taskbarPinnedAction,
  wireDockHoverZone,
  type TaskbarDockSnapshot,
} from './desktop-taskbar'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('taskbarIconMeta', () => {
  it('uses terminal sentinel metadata', () => {
    expect(taskbarIconMeta('terminal')).toEqual({ glyph: '~', label: 'Terminal' })
  })

  it('falls back for unknown commands', () => {
    expect(taskbarIconMeta('unknown-cmd')).toEqual({ glyph: '?', label: 'unknown-cmd' })
  })
})

describe('orderedDockCommands', () => {
  it('dedupes open then minimized order', () => {
    expect(orderedDockCommands(['edit', 'resume'], ['edit', 'paint'])).toEqual([
      'edit',
      'resume',
      'paint',
    ])
  })
})

describe('extraDockCommands', () => {
  it('filters pinned dock entries', () => {
    const dock = ['terminal', 'edit', 'paint', 'snake']
    expect(extraDockCommands(dock)).toEqual(['paint', 'snake'])
  })

  it('honours an explicit pinned set over the default', () => {
    const dock = ['terminal', 'edit', 'paint']
    expect(extraDockCommands(dock, ['paint'])).toEqual(['terminal', 'edit'])
  })
})

describe('taskbarPinnedAction', () => {
  it('minimizes focused terminal tile', () => {
    expect(taskbarPinnedAction('terminal', true, true)).toEqual({
      type: 'minimize-terminal-tile',
    })
  })

  it('opens terminal when tile missing or unfocused', () => {
    expect(taskbarPinnedAction('terminal', false, false)).toEqual({
      type: 'open-terminal-tile',
    })
    expect(taskbarPinnedAction('terminal', true, false)).toEqual({
      type: 'open-terminal-tile',
    })
  })

  it('opens the command directly for non-terminal pinned apps', () => {
    // Terminal-tile flags are ignored once the command is not the sentinel.
    expect(taskbarPinnedAction('whoami', true, true)).toEqual({
      type: 'open-command',
      cmd: 'whoami',
    })
  })
})

describe('buildTaskbarDockSnapshot', () => {
  it('includes extras outside pinned dock cmds', () => {
    const snap = buildTaskbarDockSnapshot('edit', ['edit'], ['paint'])
    expect(snap.extraCommands).toEqual(['paint'])
  })
})

describe('focusedTitleLabel', () => {
  it('shows site name when nothing is focused and no windows', () => {
    expect(focusedTitleLabel(null, 0)).toBe('mrgrey.site')
  })

  it('shows em dash when windows exist but none focused', () => {
    expect(focusedTitleLabel(null, 2)).toBe('—')
  })

  it('shows terminal prompt when terminal tile is focused', () => {
    expect(focusedTitleLabel('terminal', 1)).toBe('namefailed@dev — ~/terminal')
  })

  it('falls back to icon-meta label for a focused non-terminal command', () => {
    expect(focusedTitleLabel('whoami', 1)).toBe('About me')
    expect(focusedTitleLabel('unknown-cmd', 1)).toBe('unknown-cmd')
  })
})

// ── resolveDockWindows ──────────────────────────────────────────────────────────

/** Minimal TiledWin stand-in: only `command` is read by resolveDockWindows. */
function fakeWin(command: string): TiledWin {
  return { command } as unknown as TiledWin
}

describe('resolveDockWindows', () => {
  it('orders open windows first, then unique minimized, as live refs', () => {
    const open = [fakeWin('edit'), fakeWin('resume')]
    const minimized: MinimizedEntry[] = [
      { win: fakeWin('edit') }, // dup of an open window — dropped
      { win: fakeWin('paint') },
    ]

    const out = resolveDockWindows(open, minimized)

    // edit + resume keep their open refs; paint comes from the minimized entry.
    expect(out.map(w => w.command)).toEqual(['edit', 'resume', 'paint'])
    expect(out[0]).toBe(open[0])
    expect(out[1]).toBe(open[1])
    expect(out[2]).toBe(minimized[1].win)
  })

  it('returns an empty list when nothing is open or minimized', () => {
    expect(resolveDockWindows([], [])).toEqual([])
  })
})

// ── syncYasbFocusedTitle ────────────────────────────────────────────────────────

describe('syncYasbFocusedTitle', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('writes the focused label into the #yasb-focused element', () => {
    const el = document.createElement('span')
    el.id = 'yasb-focused'
    document.body.appendChild(el)

    syncYasbFocusedTitle('terminal', 1, document)
    expect(el.textContent).toBe('namefailed@dev — ~/terminal')

    syncYasbFocusedTitle(null, 0, document)
    expect(el.textContent).toBe('mrgrey.site')
  })

  it('no-ops (no throw) when the yasb element is absent', () => {
    expect(() => syncYasbFocusedTitle('whoami', 1, document)).not.toThrow()
  })
})

// ── syncDockAutoHide ────────────────────────────────────────────────────────────

describe('syncDockAutoHide', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function mountTaskbar(): { taskbar: HTMLElement; dock: HTMLElement } {
    const taskbar = document.createElement('div')
    taskbar.id = 'wm-taskbar'
    const dock = document.createElement('div')
    taskbar.appendChild(dock)
    document.body.appendChild(taskbar)
    return { taskbar, dock }
  }

  it('adds the auto-hide class when maximized', () => {
    const { taskbar, dock } = mountTaskbar()
    syncDockAutoHide(dock, true)
    expect(taskbar.classList.contains('dock--auto-hide')).toBe(true)
  })

  it('removes auto-hide + visible classes when not maximized', () => {
    const { taskbar, dock } = mountTaskbar()
    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    syncDockAutoHide(dock, false)

    expect(taskbar.classList.contains('dock--auto-hide')).toBe(false)
    expect(taskbar.classList.contains('dock--visible')).toBe(false)
  })

  it('no-ops when the dock has no #wm-taskbar ancestor', () => {
    const orphan = document.createElement('div')
    document.body.appendChild(orphan)
    expect(() => syncDockAutoHide(orphan, true)).not.toThrow()
    expect(orphan.classList.contains('dock--auto-hide')).toBe(false)
  })
})

// ── renderTaskbarDock ───────────────────────────────────────────────────────────

describe('renderTaskbarDock', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  function snapshot(over: Partial<TaskbarDockSnapshot> = {}): TaskbarDockSnapshot {
    return {
      focusedId: null,
      openCommands: [],
      minimizedCommands: [],
      extraCommands: [],
      ...over,
    }
  }

  function makeDock(): HTMLElement {
    const dock = document.createElement('div')
    document.body.appendChild(dock)
    return dock
  }

  it('renders one idle button per pinned command with glyph + label', () => {
    const dock = makeDock()
    renderTaskbarDock(dock, snapshot(), { onPinnedClick: vi.fn(), onExtraClick: vi.fn() })

    const btns = [...dock.querySelectorAll('.wm-task-btn')]
    expect(btns).toHaveLength(7) // PINNED_DOCK_CMDS length

    const terminalBtn = btns.find(b => (b as HTMLElement).dataset.cmd === 'terminal')!
    expect(terminalBtn.querySelector('.wm-task-glyph')?.textContent).toBe('~')
    expect(terminalBtn.querySelector('.wm-task-label')?.textContent).toBe('Terminal')
    expect(terminalBtn.getAttribute('aria-label')).toBe('Terminal')
    // Nothing running → every pinned button is idle, none active/minimized.
    expect(btns.every(b => b.classList.contains('wm-task-btn--idle'))).toBe(true)
    expect(dock.querySelectorAll('.wm-task-btn--active')).toHaveLength(0)
    expect(dock.querySelectorAll('.wm-dock-sep')).toHaveLength(0)
  })

  it('marks the focused pinned command active and the minimized one minimized (not idle)', () => {
    const dock = makeDock()
    renderTaskbarDock(
      dock,
      snapshot({ focusedId: 'whoami', openCommands: ['whoami'], minimizedCommands: ['edit'] }),
      { onPinnedClick: vi.fn(), onExtraClick: vi.fn() },
    )

    const whoami = dock.querySelector<HTMLElement>('[data-cmd="whoami"]')!
    expect(whoami.classList.contains('wm-task-btn--active')).toBe(true)
    expect(whoami.classList.contains('wm-task-btn--idle')).toBe(false)
    expect(whoami.classList.contains('wm-task-btn--minimized')).toBe(false)

    const edit = dock.querySelector<HTMLElement>('[data-cmd="edit"]')!
    expect(edit.classList.contains('wm-task-btn--minimized')).toBe(true)
    expect(edit.classList.contains('wm-task-btn--idle')).toBe(false)
    expect(edit.classList.contains('wm-task-btn--active')).toBe(false)
  })

  it('routes a pinned button click through onPinnedClick with its command', () => {
    const dock = makeDock()
    const onPinnedClick = vi.fn<(cmd: string) => void>()
    renderTaskbarDock(dock, snapshot(), { onPinnedClick, onExtraClick: vi.fn() })

    dock.querySelector<HTMLElement>('[data-cmd="resume"]')!.click()
    expect(onPinnedClick).toHaveBeenCalledTimes(1)
    expect(onPinnedClick).toHaveBeenCalledWith('resume')
  })

  it('renders a separator + extra buttons and routes extra clicks', () => {
    const dock = makeDock()
    const onExtraClick = vi.fn<(cmd: string) => void>()
    renderTaskbarDock(
      dock,
      snapshot({
        focusedId: 'snake',
        openCommands: ['snake'],
        minimizedCommands: ['paint'],
        extraCommands: ['snake', 'paint'],
      }),
      { onPinnedClick: vi.fn(), onExtraClick },
    )

    expect(dock.querySelectorAll('.wm-dock-sep')).toHaveLength(1)
    // Two extra buttons in addition to the 7 pinned ones.
    expect(dock.querySelectorAll('.wm-task-btn')).toHaveLength(9)

    const extras = [...dock.querySelectorAll<HTMLElement>('.wm-task-btn')].filter(
      b => ['snake', 'paint'].includes(b.dataset.cmd ?? ''),
    )
    expect(extras).toHaveLength(2)

    const snakeBtn = extras.find(b => b.dataset.cmd === 'snake')!
    expect(snakeBtn.classList.contains('wm-task-btn--active')).toBe(true)
    // Extra buttons never get the idle class even when not running.
    expect(snakeBtn.classList.contains('wm-task-btn--idle')).toBe(false)

    const paintBtn = extras.find(b => b.dataset.cmd === 'paint')!
    expect(paintBtn.classList.contains('wm-task-btn--minimized')).toBe(true)

    paintBtn.click()
    expect(onExtraClick).toHaveBeenCalledWith('paint')
  })

  it('clears prior buttons on a re-render (replaceChildren)', () => {
    const dock = makeDock()
    const handlers = { onPinnedClick: vi.fn(), onExtraClick: vi.fn() }
    renderTaskbarDock(dock, snapshot({ extraCommands: ['snake'] }), handlers)
    expect(dock.querySelectorAll('.wm-task-btn')).toHaveLength(8)

    // Re-render with no extras → back to just the pinned set, no leftovers.
    renderTaskbarDock(dock, snapshot(), handlers)
    expect(dock.querySelectorAll('.wm-task-btn')).toHaveLength(7)
    expect(dock.querySelectorAll('.wm-dock-sep')).toHaveLength(0)
  })
})

// ── wireDockHoverZone ───────────────────────────────────────────────────────────

describe('wireDockHoverZone', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  function mount(): { taskbar: HTMLElement; dock: HTMLElement } {
    const taskbar = document.createElement('div')
    taskbar.id = 'wm-taskbar'
    const dock = document.createElement('div')
    taskbar.appendChild(dock)
    document.body.appendChild(taskbar)
    return { taskbar, dock }
  }

  function zone(): HTMLElement {
    return document.querySelector<HTMLElement>('.dock-hover-zone')!
  }

  it('no-ops (creates no hover zone) when the dock has no taskbar ancestor', () => {
    const orphan = document.createElement('div')
    document.body.appendChild(orphan)
    wireDockHoverZone(orphan, document)
    expect(document.querySelector('.dock-hover-zone')).toBeNull()
  })

  it('appends a hover zone and reveals the dock on zone pointerenter', () => {
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    expect(zone()).not.toBeNull()
    expect(taskbar.classList.contains('dock--visible')).toBe(false)

    zone().dispatchEvent(new Event('pointerenter'))
    expect(taskbar.classList.contains('dock--visible')).toBe(true)
  })

  it('reveals on taskbar pointerenter and focusin too', () => {
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.dispatchEvent(new Event('pointerenter'))
    expect(taskbar.classList.contains('dock--visible')).toBe(true)

    taskbar.classList.remove('dock--visible')
    taskbar.dispatchEvent(new Event('focusin'))
    expect(taskbar.classList.contains('dock--visible')).toBe(true)
  })

  it('schedules a hide on pointerleave that fires only in auto-hide mode', () => {
    vi.useFakeTimers()
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    // relatedTarget outside the taskbar → enters the scheduleHide branch.
    const leave = new Event('pointerleave') as PointerEvent
    Object.defineProperty(leave, 'relatedTarget', { value: document.body })
    taskbar.dispatchEvent(leave)

    // Not yet hidden — the 420ms timer is still pending.
    expect(taskbar.classList.contains('dock--visible')).toBe(true)
    vi.advanceTimersByTime(420)
    expect(taskbar.classList.contains('dock--visible')).toBe(false)
  })

  it('schedules a hide when pointerleave relatedTarget is null', () => {
    vi.useFakeTimers()
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    // relatedTarget null → not a Node → first arm of the guard is true.
    const leave = new Event('pointerleave') as PointerEvent
    Object.defineProperty(leave, 'relatedTarget', { value: null })
    taskbar.dispatchEvent(leave)

    vi.advanceTimersByTime(420)
    expect(taskbar.classList.contains('dock--visible')).toBe(false)
  })

  it('does not hide on pointerleave when not in auto-hide mode', () => {
    vi.useFakeTimers()
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--visible') // visible but NOT auto-hide

    const leave = new Event('pointerleave') as PointerEvent
    Object.defineProperty(leave, 'relatedTarget', { value: document.body })
    taskbar.dispatchEvent(leave)

    vi.advanceTimersByTime(420)
    // Timer fired but the auto-hide guard kept the dock visible.
    expect(taskbar.classList.contains('dock--visible')).toBe(true)
  })

  it('does not schedule a hide when pointerleave stays inside the taskbar', () => {
    vi.useFakeTimers()
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    // relatedTarget IS inside the taskbar → guard short-circuits, no hide.
    const leave = new Event('pointerleave') as PointerEvent
    Object.defineProperty(leave, 'relatedTarget', { value: dock })
    taskbar.dispatchEvent(leave)

    vi.advanceTimersByTime(420)
    expect(taskbar.classList.contains('dock--visible')).toBe(true)
  })

  it('re-reveal cancels a pending hide timer', () => {
    vi.useFakeTimers()
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    const leave = new Event('pointerleave') as PointerEvent
    Object.defineProperty(leave, 'relatedTarget', { value: document.body })
    taskbar.dispatchEvent(leave) // schedule hide

    taskbar.dispatchEvent(new Event('pointerenter')) // reveal → clears the timer

    vi.advanceTimersByTime(420)
    // Timer was cleared, so the dock stays revealed.
    expect(taskbar.classList.contains('dock--visible')).toBe(true)
  })

  it('schedules a hide on focusout leaving the taskbar (keyboard path)', () => {
    vi.useFakeTimers()
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    const out = new Event('focusout') as FocusEvent
    Object.defineProperty(out, 'relatedTarget', { value: document.body })
    taskbar.dispatchEvent(out)

    vi.advanceTimersByTime(420)
    expect(taskbar.classList.contains('dock--visible')).toBe(false)
  })

  it('does not hide on focusout when focus stays inside the taskbar', () => {
    vi.useFakeTimers()
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    const out = new Event('focusout') as FocusEvent
    Object.defineProperty(out, 'relatedTarget', { value: dock })
    taskbar.dispatchEvent(out)

    vi.advanceTimersByTime(420)
    expect(taskbar.classList.contains('dock--visible')).toBe(true)
  })

  it('a second scheduleHide clears the first pending timer (single hide)', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { taskbar, dock } = mount()
    wireDockHoverZone(dock, document)

    taskbar.classList.add('dock--auto-hide', 'dock--visible')

    const leave = (): void => {
      const ev = new Event('pointerleave') as PointerEvent
      Object.defineProperty(ev, 'relatedTarget', { value: document.body })
      taskbar.dispatchEvent(ev)
    }
    leave() // first schedule
    leave() // second schedule must clear the first timer

    expect(clearSpy).toHaveBeenCalled()
    vi.advanceTimersByTime(420)
    expect(taskbar.classList.contains('dock--visible')).toBe(false)
  })
})
