(function () {
  const config = window.APP_CONFIG || {};
  const authScreen = document.getElementById("authScreen");
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const logoutButton = document.getElementById("logoutButton");

  if (!window.supabase || !config.supabaseUrl || !config.supabasePublishableKey) {
    loginMessage.textContent = "Configuração do Supabase não encontrada.";
    document.body.classList.remove("auth-loading");
    return;
  }

  const client = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey
  );

  window.supabaseClient = client;

  async function isAdministrator(userId) {
    const { data, error } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async function applySession(session) {
    if (!session?.user) {
      authScreen.classList.remove("hidden");
      logoutButton.classList.add("hidden");
      document.body.classList.add("auth-loading");
      return;
    }

    try {
      const allowed = await isAdministrator(session.user.id);
      if (!allowed) {
        await client.auth.signOut();
        loginMessage.textContent = "Este usuário não possui acesso administrativo.";
        return;
      }

      loginMessage.textContent = "";
      authScreen.classList.add("hidden");
      logoutButton.classList.remove("hidden");
      document.body.classList.remove("auth-loading");
      window.dispatchEvent(new CustomEvent("app-authenticated", {
        detail: { user: session.user }
      }));
    } catch (error) {
      loginMessage.textContent = "Não foi possível validar o acesso administrativo.";
      console.error("Falha ao validar administrador:", error.code, error.message);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    loginMessage.textContent = "Entrando...";

    const { data: result, error } = await client.auth.signInWithPassword({
      email: data.get("email"),
      password: data.get("password")
    });

    if (error) {
      loginMessage.textContent = "E-mail ou senha inválidos.";
      return;
    }

    await applySession(result.session);
    loginForm.reset();
  });

  logoutButton.addEventListener("click", async () => {
    await client.auth.signOut();
  });

  client.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => applySession(session), 0);
  });

  client.auth.getSession().then(({ data }) => applySession(data.session));
})();
