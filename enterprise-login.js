const SESSION_KEY = 'fitgurt-enterprise-session';
const form = document.getElementById('loginForm'),
  email = document.getElementById('email'),
  password = document.getElementById('password'),
  error = document.getElementById('formError');

try {
  const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
  if (saved?.expiresAt > Date.now()) window.location.replace('enterprise.html');
} catch {}

document.getElementById('togglePassword').onclick = () => {
  const visible = password.type === 'text';
  password.type = visible ? 'password' : 'text';
  document.getElementById('togglePassword').textContent = visible ? 'Mostrar' : 'Ocultar';
};

form.onsubmit = async (event) => {
  event.preventDefault();
  error.hidden = true;
  if (!form.checkValidity()) {
    error.textContent = 'Completa el correo y la contraseña para continuar.';
    error.hidden = false;
    return;
  }
  const submitButton = form.querySelector('.login-button');
  submitButton.disabled = true;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: password.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      error.textContent = data.error || 'Las credenciales no coinciden. Revisa los datos e inténtalo nuevamente.';
      error.hidden = false;
      submitButton.disabled = false;
      return;
    }
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ name: data.name, email: data.email, token: data.token, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })
    );
    window.location.replace('enterprise.html');
  } catch (err) {
    error.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
    error.hidden = false;
    submitButton.disabled = false;
  }
};
