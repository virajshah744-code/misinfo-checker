# Screenshots

Full-page captures of the live VeriLens web client at
<https://verilens-mu.vercel.app>, one per sidebar view. Taken with Playwright
(Chromium, 1440px wide) on 2026-09-19.

| # | View | File |
|---|------|------|
| 1 | Command center | [01-command-center.png](01-command-center.png) |
| 2 | Multimodal analysis | [02-multimodal-analysis.png](02-multimodal-analysis.png) |
| 3 | Media packet | [03-media-packet.png](03-media-packet.png) |
| 4 | Evidence fusion | [04-evidence-fusion.png](04-evidence-fusion.png) |
| 5 | Response studio | [05-response-studio.png](05-response-studio.png) |
| 6 | Time & narrative radar | [06-time-narrative-radar.png](06-time-narrative-radar.png) |
| 7 | Human review | [07-human-review.png](07-human-review.png) |

## Command center
![Command center](01-command-center.png)

## Multimodal analysis
![Multimodal analysis](02-multimodal-analysis.png)

## Media packet
![Media packet](03-media-packet.png)

## Evidence fusion
![Evidence fusion](04-evidence-fusion.png)

## Response studio
![Response studio](05-response-studio.png)

## Time & narrative radar
![Time & narrative radar](06-time-narrative-radar.png)

## Human review
![Human review](07-human-review.png)

## Notes

- The app has no router, so each view was captured by clicking its sidebar
  button. Each shot is a fresh session, so the pages show their empty or
  illustrative state, not the results of a real check.
- The API status (**online**, 6/6 models and retrievers ready) comes from real
  responses from `https://verilens-api.onrender.com/api/health`. There is a
  catch: the deployed Vercel build's `VITE_API_ORIGIN` starts with a UTF-8 BOM
  (`%EF%BB%BF`), so a normal browser asks
  `verilens-mu.vercel.app/%EF%BB%BFhttps://verilens-api...` and gets a 404.
  Because of that, visitors currently see "API offline". For these captures,
  Playwright sent those requests on to the real API. To fix the site for
  everyone, set `VITE_API_ORIGIN` again without the BOM and redeploy.

## Retaking

```js
// npm i playwright && npx playwright install chromium
for (const label of ['Command center', 'Multimodal analysis', /* … */]) {
  await page.locator('.side .nav button', { hasText: label }).click()
  // (Before the loop, a page.route() handler sends any URL containing
  // "verilens-api.onrender.com" to the real API. That works around the BOM.)
  // Grow the viewport to the page height rather than using fullPage:true,
  // so the fixed ambient background covers the whole capture.
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.setViewportSize({ width: 1440, height: h })
  await page.screenshot({ path: `${label}.png`, fullPage: true })
}
```
