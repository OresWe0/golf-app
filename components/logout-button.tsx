import { signOut } from '../app/logout/actions'

export function LogoutButton({
  label = 'Logga ut',
  className = 'secondary',
}: {
  label?: string
  className?: string
}) {
  return (
    <form action={signOut}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  )
}