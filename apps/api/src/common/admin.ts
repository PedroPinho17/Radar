/** Emails com acesso à página de estado (ADMIN_EMAILS=a@x.pt,b@y.pt). */
const admins = () =>
  new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export const isAdmin = (email: string) => admins().has(email.toLowerCase());
