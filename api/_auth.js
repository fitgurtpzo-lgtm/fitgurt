import crypto from 'crypto';

const SECRET = process.env.ADMIN_TOKEN_SECRET || 'fitgurt-dev-secret-cambia-esto';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('hex');
}

export function createToken(email) {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = JSON.stringify({ email, expires });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [encoded, sig] = String(token).split('.');
    if (!encoded || !sig) return null;
    const expectedSig = sign(encoded);
    if (sig !== expectedSig) return null;
    const { email, expires } = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!email || !expires || Date.now() > expires) return null;
    return { email, expires };
  } catch {
    return null;
  }
}

export function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = token ? verifyToken(token) : null;
  if (!session) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }
  return session;
}
