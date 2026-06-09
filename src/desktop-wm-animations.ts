/** Tiled window mount/unmount animations (matches `desktop.ts` slack timers). */

export const WM_MOUNT_MS = 640
export const WM_UNMOUNT_MS = 400

/** One-shot entrance (tiling pane or terminal restored from minimized). */
export function playWmMountAnim(el: HTMLElement, mountMs = WM_MOUNT_MS): void {
  el.classList.remove('wm-animate-close')
  el.classList.add('wm-animate-mount')
  let done = false
  const finish = (): void => {
    if (done) return
    done = true
    el.classList.remove('wm-animate-mount')
    el.removeEventListener('animationend', onEnd)
  }
  const onEnd = (e: AnimationEvent): void => {
    if (e.target === el) finish()
  }
  el.addEventListener('animationend', onEnd)
  window.setTimeout(finish, mountMs)
}

/** Fade/shrink tile, then invoke `done` — skips animation when reduced motion is on. */
export function animateWmThenRemove(
  el: HTMLElement,
  done: () => void,
  opts: { unmountMs?: number; reducedMotion?: boolean } = {},
): void {
  const unmountMs = opts.unmountMs ?? WM_UNMOUNT_MS
  if (!el.isConnected || opts.reducedMotion) {
    done()
    return
  }
  el.classList.add('wm-animate-close')
  let finished = false
  const finalize = (): void => {
    if (finished) return
    finished = true
    el.removeEventListener('animationend', onEnd)
    el.classList.remove('wm-animate-close')
    done()
  }
  const onEnd = (e: AnimationEvent): void => {
    if (e.target === el) finalize()
  }
  el.addEventListener('animationend', onEnd)
  window.setTimeout(finalize, unmountMs)
}
