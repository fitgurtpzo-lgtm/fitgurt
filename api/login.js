import { createToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Método no permitido');
  }

  const { email, password } = req.body || {};
  const validEmail = process.env.ADMIN_EMAIL;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validEmail || !validPassword) {
    return res.status(500).json({ error: 'El servidor no tiene configuradas las credenciales (ADMIN_EMAIL / ADMIN_PASSWORD).' });
  }

  if (!email || !password || email.trim().toLowerCase() !== validEmail.toLowerCase() || password !== validPassword) {
    return res.status(401).json({ error: 'Las credenciales no coinciden. Revisa los datos e inténtalo nuevamente.' });
  }

  const token = createToken(validEmail);
  return res.status(200).json({ token, name: 'Fitgurt Manager', email: validEmail });
}
