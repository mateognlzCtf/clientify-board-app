/**
 * Resultado estándar de todas las funciones en services/.
 * Siempre devuelve { data, error } para manejo consistente de errores.
 */
export type ServiceResult<T> = {
  data: T | null
  error: string | null
}

export type PaginatedResult<T> = {
  data: T[]
  count: number
  error: string | null
}
