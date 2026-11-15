export function DockerIcon({ className }: { className?: string } = {}) {
  return (
    <svg className={className} width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12.5 5.5H10V3h2.5v2.5ZM10 9h2.5V6.5H10V9Zm-9 5.283c0 4.714 3.53 7.857 8.38 7.857 5.02 0 10.271 -3.976 10.271 -8.995 1.303 0.553 2.851 -0.156 3.349 -1.481 -0.498 -1.322 -1.48 -1.502 -2.781 -0.951 0.478 -2.392 -2.13 -2.654 -2.13 -2.654s-1.62 1.203 -0.185 3.116c0 0 -0.142 2.584 -2.238 2.584H1.524c-0.269 0 -0.535 0.256 -0.524 0.524ZM16 12.5h-2.5V10H16v2.5Zm-6 0h2.5V10H10v2.5Zm-1 0H6.5V10H9v2.5ZM6.5 9H9V6.5H6.5V9Zm-1 3.5H3V10h2.5v2.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// Used only by the settings preview, which draws a slice of the activity bar.
export function FilesIcon() {
  return (
    <svg width="1.5rem" height="1.5rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5C3 3.9 3.9 3 5 3H10.17C10.7 3 11.21 3.21 11.59 3.59L12.41 4.41C12.79 4.79 13.3 5 13.83 5H19C20.1 5 21 5.9 21 7V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function GitIcon({ className }: { className?: string } = {}) {
  return (
    <svg className={className} width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="9" cy="19" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10.4 6.2C12 8 13.5 9.5 13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
