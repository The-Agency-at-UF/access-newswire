import type { Locator, Page } from '@playwright/test'

declare global {
  interface Window {
    __demoCaption?: (text: string) => void
  }
}

/**
 * A visible cursor and a caption bar, drawn into every page. Recorded video
 * shows neither the real mouse nor any narration, so the demo adds its own.
 * Both survive full page loads through sessionStorage.
 */
function overlay() {
  const store = {
    get: (key: string) => {
      try {
        return sessionStorage.getItem(key)
      } catch {
        return null
      }
    },
    set: (key: string, value: string) => {
      try {
        sessionStorage.setItem(key, value)
      } catch {
        // Not worth failing the recording over.
      }
    },
  }

  const mount = () => {
    if (document.getElementById('demo-cursor')) return
    const cursor = document.createElement('div')
    cursor.id = 'demo-cursor'
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8-6.5 1.6L8.5 18z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, {
      position: 'fixed',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'transform 40ms linear',
      left: '0',
      top: '0',
    })
    const [x, y] = (store.get('demo-cursor') ?? '720,450').split(',')
    cursor.style.transform = `translate(${x}px, ${y}px)`

    const caption = document.createElement('div')
    caption.id = 'demo-caption'
    Object.assign(caption.style, {
      position: 'fixed',
      zIndex: '2147483646',
      pointerEvents: 'none',
      left: '50%',
      bottom: '28px',
      transform: 'translateX(-50%)',
      maxWidth: '980px',
      padding: '14px 22px',
      borderRadius: '12px',
      background: 'rgba(17, 17, 17, 0.88)',
      color: '#fff',
      font: '500 21px/1.4 system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
      transition: 'opacity 200ms',
    })
    const text = store.get('demo-caption') ?? ''
    caption.textContent = text
    caption.style.opacity = text ? '1' : '0'

    // Room for the caption: toasts move to the top, and pages get space to
    // scroll their last controls clear of it.
    const style = document.createElement('style')
    style.id = 'demo-style'
    style.textContent = '.toast { top: 72px !important; bottom: auto !important; } .page { padding-bottom: 180px !important; }'

    document.head.append(style)
    document.body.append(cursor, caption)
  }

  window.__demoCaption = (text: string) => {
    store.set('demo-caption', text)
    mount()
    const caption = document.getElementById('demo-caption')
    if (!caption) return
    caption.textContent = text
    caption.style.opacity = text ? '1' : '0'
  }

  document.addEventListener(
    'mousemove',
    (event) => {
      store.set('demo-cursor', `${event.clientX},${event.clientY}`)
      mount()
      const cursor = document.getElementById('demo-cursor')
      if (cursor) cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`
    },
    true,
  )
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
}

export async function installOverlay(page: Page) {
  await page.addInitScript(overlay)
}

let shot = 0

/**
 * Show a caption and hold on it long enough to read. With DEMO_SHOTS=1 it
 * also saves a screenshot per caption (out/shots), to check the video's look.
 */
export async function caption(page: Page, text: string, holdMs = 4000) {
  await page.evaluate((t) => window.__demoCaption?.(t), text)
  if (process.env.DEMO_SHOTS) await page.waitForTimeout(300).then(() => page.screenshot({ path: `out/shots/${String(++shot).padStart(2, '0')}.png` }))
  await page.waitForTimeout(holdMs)
}

/** Scroll an element to the middle of the screen (clear of the caption) and move the cursor to it. */
export async function glide(page: Page, target: Locator) {
  await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  await page.waitForTimeout(600)
  const box = await target.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 18), { steps: 30 })
  await page.waitForTimeout(300)
}

export async function click(page: Page, target: Locator) {
  await glide(page, target)
  await target.click()
}

/** Click into a field and type at a readable speed. */
export async function type(page: Page, target: Locator, text: string) {
  await click(page, target)
  await target.pressSequentially(text, { delay: 35 })
}
