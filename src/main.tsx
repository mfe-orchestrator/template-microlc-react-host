// configure() must run at the very top of the entry point, synchronously, before
// anything asks for a remote. It is idempotent.
import { configure } from '@mfe-orchestrator-hub/client'

// VITE_MFE_ENVIRONMENT is optional. An unset variable arrives as undefined, one
// declared empty in .env arrives as an empty string, and neither is a usable
// environment slug: in both cases the key is left out of configure() entirely and
// the backend resolves the environment from the domain the request comes from.
const environment = import.meta.env.VITE_MFE_ENVIRONMENT?.trim()

configure({
  backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
  projectId: import.meta.env.VITE_MFE_PROJECT_ID,
  ...(environment ? { environment } : {})
})

// Publishes the host's React on window for the parcels (see shared-react.ts).
import './shared-react'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { buildMicrolcConfig } from './microlc-config'
import { Nav } from './Nav'
import './index.css'

createRoot(document.getElementById('nav') as HTMLElement).render(
  <StrictMode>
    <Nav />
  </StrictMode>
)

const mountPoint = document.getElementById('microlc') as HTMLElement
try {
  // The configuration is built at runtime: every parcel entry comes from
  // remoteUrl(), i.e. from the version the console serves to this page right now.
  const config = await buildMicrolcConfig()
  await customElements.whenDefined('micro-lc')
  // Not document.createElement(): micro-lc's constructor appends children, which
  // the DOM only allows to elements created by the parser. Setting the config in
  // the same task as the insertion makes micro-lc render it once, skipping the
  // empty default config it starts with.
  mountPoint.innerHTML = '<micro-lc></micro-lc>'
  ;(mountPoint.firstElementChild as HTMLElementTagNameMap['micro-lc']).config = config
} catch (error) {
  console.error('[host] cannot start micro-lc', error)
  mountPoint.textContent = 'The microfrontends could not be loaded.'
}
