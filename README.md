# micro-lc & React — host template

Starter template for the [MFE Orchestrator](https://github.com/mfe-orchestrator): a
[micro-lc](https://micro-lc.io) 2 shell with a React 19 navigation bar, built with Vite. It mounts
parcels such as [template-microlc-react-remote](https://github.com/mfe-orchestrator/template-microlc-react-remote).

## Requirements

- Node.js 24 LTS
- [pnpm](https://pnpm.io) 12 (pinned in `packageManager`; `corepack enable` picks it up)

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production build into dist/
pnpm preview    # serves dist/ on http://localhost:4173
```

## Project structure

```
.
├── Dockerfile              # standalone nginx deploy, non-root, port 8080
├── nginx/default.conf
├── index.html              # <base href="/">, loads micro-lc, then src/main.tsx
├── src/
│   ├── main.tsx            # configure(), then builds the config and starts <micro-lc>
│   ├── telemetry.ts        # Application Insights, when the environment asks for it
│   ├── microlc-config.ts   # the micro-lc config, built at runtime with remoteUrl()
│   ├── shared-react.ts     # publishes the host's React on window for the parcels
│   ├── Nav.tsx             # React navigation bar
│   └── index.css
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── vite.config.ts          # copies micro-lc's runtime into public/micro-lc/
```

## How the orchestrator is wired in

**The host never decides which version it gets.** It hands over the identities it holds and uses
the URL it receives, verbatim. Which version that URL points at — stable, canary — is decided by
the backend.

**1. `configure()`, at the very top of `src/main.tsx`, synchronously:**

```ts
import { configure } from '@mfe-orchestrator-hub/client'

const environment = import.meta.env.VITE_MFE_ENVIRONMENT?.trim()

configure({
  backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
  projectId: import.meta.env.VITE_MFE_PROJECT_ID,
  ...(environment ? { environment } : {})
})
```

`environment` is optional: left out, the backend resolves it from the domain the request comes from.

**2. The micro-lc configuration is built at runtime** (`src/microlc-config.ts`), not read from a
static `config.json`. Each parcel's entry is the URL `remoteUrl()` returns for its slug:

```ts
import { remoteUrl } from '@mfe-orchestrator-hub/client'
import type { Config } from '@micro-lc/interfaces/v2'

export async function buildMicrolcConfig(): Promise<Config> {
  const [exampleRemote] = await Promise.all([remoteUrl('example-remote')])
  return {
    version: 2,
    settings: { defaultUrl: './home/' },
    applications: {
      home: { integrationMode: 'compose', route: './home/', config: { content: { /* ... */ } } },
      'example-remote': {
        integrationMode: 'parcel',
        route: './example-remote/',
        entry: { scripts: [exampleRemote] }
      }
    }
  }
}
```

and handed to micro-lc as its `config` property:

```ts
const config = await buildMicrolcConfig()
await customElements.whenDefined('micro-lc')
mountPoint.innerHTML = '<micro-lc></micro-lc>'
mountPoint.firstElementChild.config = config
```

`<micro-lc>` is inserted as markup rather than with `document.createElement()`: its constructor
appends children, which the DOM only allows to parser-created elements. Setting `config` in the same
task as the insertion makes micro-lc render that config once instead of its empty default first.

`remoteUrl()` shares one manifest request for the whole page, so resolving several remotes costs one
call. If it fails (unknown slug, console unreachable) the host logs the error and shows a message
instead of micro-lc.

The SDK also exposes `manifest()`, `globalVariables()` and `identities()`.

## Applications

| id | route | kind | why |
| --- | --- | --- | --- |
| `home` | `/home/` | `compose` (HTML described in the config) | the landing page, `settings.defaultUrl` |
| `example-remote` | `/example-remote/` | `parcel` | the remote, resolved through the SDK |

Two applications so that navigating actually unmounts and remounts the parcel. The navigation bar
(`src/Nav.tsx`) calls micro-lc's `router.goToApplication(id)`: micro-lc owns the history, and a bare
`history.pushState()` would change the URL without it noticing.

Routes resolve against `<base href="/">` in `index.html`. Change it if the host is not served from
the root of its domain.

## How micro-lc loads a parcel

micro-lc hands parcels to [qiankun](https://qiankun.umijs.org) 2.10. On the first visit of a route
qiankun `fetch()`es the entry script (the remote must answer with CORS headers), and evaluates it
inside a **JS sandbox**: a `Proxy` standing in for `window`, `self` and `globalThis`. What the parcel
writes stays in the sandbox; what it reads and did not write falls through to the real `window`.
The lifecycles (`bootstrap`, `mount`, `unmount`) come from the script's UMD export. Only classic UMD
scripts work: no ES modules, no Module Federation, no import maps for parcels.

The script is evaluated **once**: `bootstrap` runs once, then `mount` on every visit and `unmount`
on every exit. Parcels are mounted in micro-lc's light DOM, so their CSS is not isolated.

## Sharing React

A sandboxed UMD script cannot import the host's modules, so by default every React parcel would
bring its own React. The fall-through to the real `window` is what this template uses instead:
`src/shared-react.ts` publishes the host's copy before micro-lc starts,

| global | content |
| --- | --- |
| `window.React` | `react` |
| `window.ReactDOM` | `react-dom` and `react-dom/client`, merged |
| `window.ReactJSXRuntime` | `react/jsx-runtime` |

and the remote template builds with those modules as externals mapped to these globals. The page
then runs on a single React: the host's navigation bar and every parcel share it. The cost is a
contract: the names must match on both sides, and host and parcels move to a new React major
together. A parcel built without the externals still works here, it just brings its own copy.

## Adding a remote

1. Register the microfrontend in the console and note its slug.
2. In `src/microlc-config.ts`, add it to the `Promise.all` and declare the application:

   ```ts
   const [exampleRemote, checkout] = await Promise.all([remoteUrl('example-remote'), remoteUrl('checkout')])
   // ...
   checkout: { integrationMode: 'parcel', route: './checkout/', entry: { scripts: [checkout] } }
   ```

3. Add a link to `src/Nav.tsx` with the application id.

Never write a remote URL by hand: `remoteUrl()` returns it already pinned to the right version.

## micro-lc runtime

micro-lc is distributed as a self-contained bundle (`micro-lc.production.js`, qiankun included) that
loads its own files relative to itself: the composer used by `compose` applications, the 401/404/500
pages, js-yaml, es-module-shims. Re-bundling it with Vite scatters those files, so `vite.config.ts`
copies the package's `dist/` into `public/micro-lc/` (gitignored) on every dev start and build, and
`index.html` loads `/micro-lc/micro-lc.production.js`, the way micro-lc's docs load it from a CDN.
The version is the one in `package.json`.

`@micro-lc/interfaces` maps its `./v2` types to a file it does not ship, so `tsconfig.json` aliases
`@micro-lc/interfaces/v2` to the real declaration file.

## Why Vite

The shell itself is an ordinary single page app: micro-lc is a custom element and loads parcels at
runtime, so the host's bundler only has to build the React navigation and the SDK wiring. Vite is
the toolchain of the other orchestrator templates; micro-lc's runtime is copied as-is instead of
bundled (see above), so no webpack-specific behaviour is involved.

## Application Insights

The host starts [Application Insights](https://learn.microsoft.com/azure/azure-monitor/app/javascript-sdk)
when its environment has a **global variable** named `APPLICATIONINSIGHTS_CONNECTION_STRING`. Set it
in the console, on each environment you want monitored, to the connection string of that
environment's Application Insights resource. The connection string only allows ingestion, so it is
fine in a browser.

Without the variable nothing happens: `src/telemetry.ts` loads `@microsoft/applicationinsights-web`
with a dynamic `import()`, so the SDK is a chunk of its own that is never downloaded, and the page
behaves exactly as before.

With it, the host initialises the SDK once and tracks:

- page views, the first one and every route change (`enableAutoRouteTracking`);
- unhandled exceptions, of the host and of every remote;
- `fetch` and XHR calls as dependencies, with W3C (`traceparent`, `tracestate`) and classic
  (`Request-Id`, `Request-Context`) correlation headers, so a backend that reports to Application
  Insights joins the same end-to-end transaction;
- browser timings (page load, network, DOM processing).

Everything is reported under the cloud role name `ROLE_NAME` (`microlc-host-react`): rename it in
`src/telemetry.ts` after your host, so it is told apart from the backends in the application map.

**Correlation with backends.** Correlation headers go to same-origin calls only, by default. To
correlate the calls to a backend on another host, add that host to `CORRELATED_HOSTS` in
`src/telemetry.ts` (`'api.example.com'`, or `'*.example.com'`), and make sure the backend's CORS
allows the request headers `traceparent`, `tracestate`, `Request-Id` and `Request-Context`:
otherwise the browser preflight fails and the call with it.

**Remotes.** The instance is published on `window.appInsights` once loaded, and remotes use that one
instead of bundling their own SDK. Exceptions, calls and page views of a remote are already
tracked; for custom telemetry:

```ts
window.appInsights?.trackEvent({ name: 'checkout-completed' }, { items: 3 })
window.appInsights?.trackException({ exception: error })
```

Parcels run inside qiankun's sandbox, but a read the sandbox misses falls through to the real
`window` — the way parcels already reach the host's React (see [Sharing React](#sharing-react)) — so
`window.appInsights` is the host's instance for them too.

The optional chaining matters: `window.appInsights` is not there when the environment has no
connection string, nor before the SDK has finished loading, and a call made then is simply skipped.
In a TypeScript remote, declare the slice it uses, so it needs no dependency on the SDK:

```ts
declare global {
  interface Window {
    appInsights?: {
      trackEvent(event: { name: string }, properties?: Record<string, unknown>): void
      trackException(exception: { exception: Error }, properties?: Record<string, unknown>): void
    }
  }
}
```

## Environment variables

Copy `.env.example` to `.env` and fill it in. Vite injects them at build time.

| variable | required | what it is |
| --- | --- | --- |
| `VITE_MFE_BACKEND_URL` | yes | orchestrator backend, including the `/api` suffix |
| `VITE_MFE_PROJECT_ID` | yes | id of your project in the orchestrator |
| `VITE_MFE_ENVIRONMENT` | no | environment slug, ex. `DEV`. Omit it and the backend resolves the environment from the domain |

`.env` is gitignored. Never commit real values.

## Deploying

### Upload to the orchestrator

Build the app and upload `dist/` with
[`mfe-orchestrator/github-action`](https://github.com/mfe-orchestrator/github-action), passing your
orchestrator API key as a repository **secret**.

### Standalone deploy

```bash
docker build -t my-host .
docker run -p 8080:8080 my-host
```

The image runs nginx as the unprivileged `nginx` user on port 8080. `nginx/default.conf` serves
`index.html` for any route (micro-lc routes live in the browser), never caches it, caches the hashed
files under `assets/` forever and revalidates `micro-lc/`.

## License

MIT
