/**
 * La clave del proyecto debe ser 1-5 caracteres: letras mayúsculas y números,
 * empezando por una letra. Ejemplos válidos: CLF, PROJ, AB1
 */
export function isValidProjectKey(key: string): boolean {
  return /^[A-Z][A-Z0-9]{0,4}$/.test(key)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6
}
