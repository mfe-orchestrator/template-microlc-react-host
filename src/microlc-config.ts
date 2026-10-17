import { remoteUrl } from '@mfe-orchestrator-hub/client'
import type { Config } from '@micro-lc/interfaces/v2'

/**
 * micro-lc configuration, built at runtime instead of a static config.json: a
 * parcel's entry is whatever URL the console resolves for its slug, already pinned
 * to the version (stable or canary) this page must get. Never write a URL here.
 */
export async function buildMicrolcConfig(): Promise<Config> {
  // One manifest request for the whole page: remoteUrl() memoizes it.
  const [exampleRemote] = await Promise.all([remoteUrl('example-remote')])

  return {
    version: 2,
    settings: { defaultUrl: './home/' },
    applications: {
      // A second application, so that navigating unmounts and remounts the parcel.
      // "compose" renders HTML described in the config itself: no remote needed.
      home: {
        integrationMode: 'compose',
        route: './home/',
        config: {
          content: {
            tag: 'section',
            attributes: { style: 'padding: 2rem; font-family: sans-serif' },
            content: [
              { tag: 'h1', content: 'micro-lc host' },
              { tag: 'p', content: 'This page is a micro-lc "compose" application. Open "Example remote" to mount the React parcel.' }
            ]
          }
        }
      },
      // One entry per microfrontend. The key is micro-lc's application id, the
      // string passed to remoteUrl() is the slug of the microfrontend in the console.
      'example-remote': {
        integrationMode: 'parcel',
        route: './example-remote/',
        entry: { scripts: [exampleRemote] }
      }
    }
  }
}
