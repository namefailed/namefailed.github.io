import { describe, it, expect, vi, beforeAll } from 'vitest'
import {
  toggleMaximizeContent,
  toggleMaximizeFocused,
  unmaximizeContent,
  type WmMaximizeContext,
} from './desktop-wm-maximize'
import type { TiledWin } from './desktop-open-window'

class FakeEl {
  className = ''
  dataset: Record<string, string> = {}
  readonly classList = {
    add: (c: string) => {
      const parts = new Set(this.className.split(/\s+/).filter(Boolean))
      parts.add(c)
      this.className = [...parts].join(' ')
    },
    remove: (c: string) => {
      this.className = this.className
        .split(/\s+/)
        .filter(x => x && x !== c)
        .join(' ')
    },
    contains: (c: string) => this.className.split(/\s+/).includes(c),
  }
}

function mockWin(command: string): TiledWin & { el: FakeEl } {
  const el = new FakeEl()
  el.className = 'content-window'
  return {
    command,
    el: el as unknown as HTMLElement,
    isMaximized: () => el.classList.contains('maximized'),
  } as TiledWin & { el: FakeEl }
}

function makeCtx() {
  let maximizedId: string | null = null
  const panes = new FakeEl()
  const desktop = new FakeEl()
  const wins = new Map<string, TiledWin>()
  const syncDockVisibility = vi.fn()
  const onAfterMaximizeLayout = vi.fn()
  const attachVerticalSplitters = vi.fn()
  const sync = vi.fn()

  const ctx: WmMaximizeContext = {
    getMaximizedId: () => maximizedId,
    setMaximizedId: id => {
      maximizedId = id
    },
    panes: panes as unknown as HTMLElement,
    desktop: desktop as unknown as HTMLElement,
    findOpenWindow: cmd => wins.get(cmd),
    unmaximizeContent: win => unmaximizeContent(ctx, win),
    syncDockVisibility,
    onAfterMaximizeLayout,
    attachVerticalSplitters,
    sync,
  }

  return { ctx, panes, desktop, wins, syncDockVisibility, onAfterMaximizeLayout, attachVerticalSplitters, sync }
}

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    fn(0)
    return 0
  })
})

describe('toggleMaximizeContent', () => {
  it('maximizes a content window and sets shell dataset', () => {
    const { ctx, panes, desktop, wins, syncDockVisibility, onAfterMaximizeLayout } = makeCtx()
    const win = mockWin('resume')
    wins.set('resume', win)

    toggleMaximizeContent(ctx, win)

    expect(win.el.classList.contains('maximized')).toBe(true)
    expect(panes.classList.contains('max-content')).toBe(true)
    expect(ctx.getMaximizedId()).toBe('resume')
    expect(desktop.dataset.maximized).toBe('1')
    expect(syncDockVisibility).toHaveBeenCalledOnce()
    expect(onAfterMaximizeLayout).toHaveBeenCalledOnce()
  })

  it('unmaximizes when the window is already maximized', () => {
    const { ctx, panes, wins, attachVerticalSplitters, sync } = makeCtx()
    const win = mockWin('whoami')
    win.el.classList.add('maximized')
    panes.classList.add('max-content')
    ctx.setMaximizedId('whoami')
    wins.set('whoami', win)

    toggleMaximizeContent(ctx, win)

    expect(win.el.classList.contains('maximized')).toBe(false)
    expect(panes.classList.contains('max-content')).toBe(false)
    expect(ctx.getMaximizedId()).toBeNull()
    expect(attachVerticalSplitters).toHaveBeenCalledOnce()
    expect(sync).toHaveBeenCalledOnce()
  })

  it('demotes the previously maximized window when switching maximize target', () => {
    const { ctx, wins } = makeCtx()
    const a = mockWin('resume')
    const b = mockWin('links')
    wins.set('resume', a)
    wins.set('links', b)

    toggleMaximizeContent(ctx, a)
    toggleMaximizeContent(ctx, b)

    expect(a.el.classList.contains('maximized')).toBe(false)
    expect(b.el.classList.contains('maximized')).toBe(true)
    expect(ctx.getMaximizedId()).toBe('links')
  })
})

describe('toggleMaximizeFocused', () => {
  it('no-ops when nothing is focused', () => {
    const { ctx } = makeCtx()
    toggleMaximizeFocused(ctx, null)
    expect(ctx.getMaximizedId()).toBeNull()
  })

  it('maximizes the focused window command', () => {
    const { ctx, wins } = makeCtx()
    const win = mockWin('projects')
    wins.set('projects', win)

    toggleMaximizeFocused(ctx, 'projects')

    expect(win.el.classList.contains('maximized')).toBe(true)
    expect(ctx.getMaximizedId()).toBe('projects')
  })
})

describe('unmaximizeContent', () => {
  it('ignores windows that are not maximized', () => {
    const { ctx, sync } = makeCtx()
    const win = mockWin('paint')
    unmaximizeContent(ctx, win)
    expect(sync).not.toHaveBeenCalled()
  })
})
