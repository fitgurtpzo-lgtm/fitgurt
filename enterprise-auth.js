const SESSION_KEY = 'fitgurt-enterprise-session';

function getEnterpriseSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return session && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function protectEnterprise() {
  const session = getEnterpriseSession();
  if (!session) {
    window.location.replace('enterprise-login.html');
    return;
  }
  window.FITGURT_TOKEN = session.token;
  const name = document.getElementById('sessionName'),
    initials = document.getElementById('sessionInitials'),
    logout = document.getElementById('logoutButton');
  if (name) name.textContent = session.name;
  if (initials) initials.textContent = session.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  if (logout)
    logout.onclick = () => {
      localStorage.removeItem(SESSION_KEY);
      window.location.replace('enterprise-login.html');
    };
}

protectEnterprise();
