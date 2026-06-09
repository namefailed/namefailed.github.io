// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppWindow } from './appwindow'
import { resumeWindowSplitPayload } from './content/portfolio'

function chromeOpts() {
  return {
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }
}

describe('AppWindow', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('mounts app-window chrome with win-body and dataset.app', () => {
    const win = new AppWindow({
      command: 'help',
      title: 'help',
      content: ['  hello'],
      ...chromeOpts(),
    })
    document.body.appendChild(win.el)

    expect(win.el.classList.contains('app-window')).toBe(true)
    expect(win.el.dataset.app).toBe('help')
    expect(win.el.querySelector('.win-body')).not.toBeNull()
    expect(win.el.querySelector('.win-line')?.textContent).toContain('hello')
  })

  it('adds whoami-window class for about me tile', () => {
    const win = new AppWindow({
      command: 'whoami',
      title: 'about me · personal',
      content: [''],
      ...chromeOpts(),
    })
    expect(win.el.classList.contains('whoami-window')).toBe(true)
  })

  it('builds résumé skills layout when skills payload is provided', () => {
    const payload = resumeWindowSplitPayload()
    const win = new AppWindow({
      command: 'resume',
      title: 'résumé · skills',
      content: payload.content,
      resumeLead: payload.resumeLead,
      resumeBody: payload.resumeBody,
      resumeSkills: payload.resumeSkills,
      ...chromeOpts(),
    })
    expect(win.el.classList.contains('resume-window')).toBe(true)
    expect(win.el.querySelector('.resume-layout--with-skills')).not.toBeNull()
  })

  it('toggles WM state classes', () => {
    const win = new AppWindow({
      command: 'help',
      title: 'help',
      content: [],
      ...chromeOpts(),
    })
    win.setActive(true)
    win.setMinimized(true)
    expect(win.el.classList.contains('active')).toBe(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
    expect(win.isMaximized()).toBe(false)
    win.el.classList.add('maximized')
    expect(win.isMaximized()).toBe(true)
  })

  it('fires onClose from title-bar close control', () => {
    const opts = chromeOpts()
    const win = new AppWindow({
      command: 'help',
      title: 'help',
      content: [],
      ...opts,
    })
    const closeBtn = win.el.querySelector('.dot-close') as HTMLButtonElement | null
    expect(closeBtn).not.toBeNull()
    closeBtn?.click()
    expect(opts.onClose).toHaveBeenCalledOnce()
  })
})
