import { describe, expect, it } from 'vitest'
import { liveSiteScreenshotUrl } from './live-site-screenshot'

describe('liveSiteScreenshotUrl', () => {
  it('builds an mShots URL with encoded target and width', () => {
    expect(liveSiteScreenshotUrl('https://example.com/path?q=1')).toBe(
      'https://s0.wp.com/mshots/v1/https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1?w=900',
    )
  })
})
