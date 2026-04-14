export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000',
  adminPath: process.env.NEXT_PUBLIC_ADMIN_PATH ?? 'control-tower',
}
