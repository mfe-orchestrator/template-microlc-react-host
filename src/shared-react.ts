// micro-lc loads parcels through qiankun: their UMD bundle is fetch()ed and
// evaluated inside a sandbox (a Proxy standing in for window). A parcel cannot
// import modules from the host, but reads that miss the sandbox fall through to
// the real window. So the host publishes its own React there, and parcels built
// with React as an external (template-microlc-react-remote) use it instead of
// bundling a second copy.
//
// This is a contract between host and parcels: the global names below must match
// the `globals` of the parcels' build.
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as ReactJSXRuntime from 'react/jsx-runtime'

declare global {
  interface Window {
    React: typeof React
    ReactDOM: typeof ReactDOM & typeof ReactDOMClient
    ReactJSXRuntime: typeof ReactJSXRuntime
  }
}

window.React = React
window.ReactDOM = { ...ReactDOM, ...ReactDOMClient }
window.ReactJSXRuntime = ReactJSXRuntime
