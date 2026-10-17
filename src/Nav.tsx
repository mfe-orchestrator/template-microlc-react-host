import type { MouseEvent } from 'react'

// `application` is the id of the application in the micro-lc config.
const links = [
  { application: 'home', href: '/home/', label: 'Home' },
  { application: 'example-remote', href: '/example-remote/', label: 'Example remote' }
]

// micro-lc owns the history: goToApplication() pushes the route and mounts the
// application (unmounting the previous one). A bare history.pushState() would
// change the URL without micro-lc noticing.
function navigate(event: MouseEvent<HTMLAnchorElement>, application: string) {
  const microlc = document.querySelector('micro-lc')
  if (!microlc) return
  event.preventDefault()
  void microlc.getApi().router.goToApplication(application)
}

export function Nav() {
  return (
    <nav className="host-nav">
      <strong>micro-lc host</strong>
      {links.map(({ application, href, label }) => (
        <a key={application} href={href} onClick={(event) => navigate(event, application)}>
          {label}
        </a>
      ))}
    </nav>
  )
}
