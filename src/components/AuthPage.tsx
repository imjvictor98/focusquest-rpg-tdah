import React, { useEffect, useState } from 'react';
import {
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Cloud,
  Laptop,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from 'lucide-react';
import type { AuthUser } from '../types';
import {
  checkPasskeySupport,
  getSuggestedDeviceName,
  loginWithPasskey,
  loginWithPassword,
  registerWithPasskey,
  registerWithPassword,
  translateWebAuthnError,
} from '../services/api';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser, justRegisteredWithPassword?: boolean) => void;
  hasLegacyLocalData: boolean;
}

type AuthTab = 'login' | 'register';

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthenticated,
  hasLegacyLocalData,
}) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [passkeySupport, setPasskeySupport] = useState<{
    checked: boolean;
    supported: boolean;
    platformAvailable: boolean;
  }>({ checked: false, supported: true, platformAvailable: true });

  // Shared / Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPasskeyName, setRegPasskeyName] = useState(() => getSuggestedDeviceName());
  const [regAttachment, setRegAttachment] = useState<'any' | 'platform' | 'cross-platform'>('any');
  const [regUsePasswordInstead, setRegUsePasswordInstead] = useState(false);
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  // Status
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    checkPasskeySupport().then(({ supported, platformAvailable }) => {
      setPasskeySupport({ checked: true, supported, platformAvailable });
      if (!supported) {
        setShowPasswordLogin(true);
        setRegUsePasswordInstead(true);
      }
    });
  }, []);

  const clearError = () => setErrorMsg(null);

  const handlePasskeyLogin = async () => {
    clearError();
    setBusyAction('passkey-login');
    try {
      const { user } = await loginWithPasskey(loginEmail.trim() || undefined);
      onAuthenticated(user, false);
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Preencha seu e-mail e senha para entrar.');
      return;
    }
    setBusyAction('password-login');
    try {
      const { user } = await loginWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      onAuthenticated(user, false);
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handlePasskeyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (regName.trim().length < 2) {
      setErrorMsg('Digite seu nome de herói (mínimo 2 caracteres).');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMsg('Informe um e-mail válido para identificar sua conta.');
      return;
    }

    setBusyAction('passkey-register');
    try {
      const { user } = await registerWithPasskey({
        displayName: regName.trim(),
        email: regEmail.trim(),
        passkeyName: regPasskeyName.trim() || getSuggestedDeviceName(),
        authenticatorAttachment: regAttachment === 'any' ? undefined : regAttachment,
      });
      onAuthenticated(user, false);
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handlePasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (regName.trim().length < 2) {
      setErrorMsg('Digite seu nome de herói (mínimo 2 caracteres).');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMsg('Informe um e-mail válido.');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMsg('As senhas não conferem.');
      return;
    }

    setBusyAction('password-register');
    try {
      const { user } = await registerWithPassword({
        displayName: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      onAuthenticated(user, true);
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const isBusy = busyAction !== null;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="fixed top-[-80px] left-1/2 -translate-x-1/2 w-[780px] h-[300px] bg-violet-600/15 blur-[130px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[420px] h-[420px] bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] p-0.5 shadow-xl shadow-violet-500/25">
            <div className="w-full h-full rounded-[14px] bg-[#0B0F19] flex items-center justify-center">
              <Fingerprint className="w-8 h-8 text-violet-400" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              FocusQuest
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                RPG
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
              Entre sem precisar decorar senhas. Seu progresso, missões e moedas ficam sincronizados na nuvem com <strong className="text-violet-300">Passkey</strong>.
            </p>
          </div>
        </div>

        {/* Legacy localStorage detection hint */}
        {hasLegacyLocalData && (
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
            <Cloud className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Progresso local detectado neste navegador!</p>
              <p className="text-amber-200/80 mt-0.5">
                Crie sua conta ou faça login para importar seu nível, XP e missões direto para o banco de dados na nuvem.
              </p>
            </div>
          </div>
        )}

        {/* Main Auth Card */}
        <div className="bg-[#131A2A]/95 backdrop-blur-md border border-[#1E293B] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#0B0F19] p-1.5 rounded-2xl border border-[#1E293B]">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setTab('login');
                clearError();
              }}
              className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${
                tab === 'login'
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setTab('register');
                clearError();
              }}
              className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${
                tab === 'register'
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Passkey Browser Support Badge */}
          {passkeySupport.checked && (
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs ${
                passkeySupport.supported
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              {passkeySupport.supported ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    {passkeySupport.platformAvailable
                      ? 'Passkey com biometria / PIN pronta neste dispositivo'
                      : 'Passkey suportada (via celular / QR Code ou chave USB)'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    Este navegador não suporta Passkeys. Use e-mail e senha como alternativa.
                  </span>
                </>
              )}
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB: LOGIN                                                      */}
          {/* =============================================================== */}
          {tab === 'login' && (
            <div className="space-y-4">
              {passkeySupport.supported && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="login-email-optional"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      E-mail <span className="text-slate-500 font-normal">(opcional para Passkey)</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="login-email-optional"
                        type="email"
                        autoComplete="username webauthn"
                        placeholder="Deixe vazio para entrar em 1 clique"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          clearError();
                        }}
                        disabled={isBusy}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handlePasskeyLogin}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-violet-500/25 transition-all active:scale-[0.98]"
                  >
                    {busyAction === 'passkey-login' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Aguardando biometria / Passkey...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5" />
                        <span>Entrar com Passkey</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Divider + Password Fallback Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordLogin((v) => !v);
                    clearError();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-violet-300 py-1.5 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {showPasswordLogin
                      ? 'Ocultar login com senha'
                      : 'Ou entrar com e-mail e senha (fallback)'}
                  </span>
                  {showPasswordLogin ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {showPasswordLogin && (
                <form
                  onSubmit={handlePasswordLogin}
                  className="space-y-3 pt-2 border-t border-[#1E293B]"
                >
                  {!passkeySupport.supported && (
                    <div>
                      <label
                        htmlFor="login-email-pwd"
                        className="block text-xs font-semibold text-slate-300 mb-1.5"
                      >
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="login-email-pwd"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="voce@exemplo.com"
                          value={loginEmail}
                          onChange={(e) => {
                            setLoginEmail(e.target.value);
                            clearError();
                          }}
                          disabled={isBusy}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="Sua senha de recuperação"
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          clearError();
                        }}
                        disabled={isBusy}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-slate-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {busyAction === 'password-login' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar com Senha</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB: REGISTER                                                   */}
          {/* =============================================================== */}
          {tab === 'register' && (
            <form
              onSubmit={regUsePasswordInstead ? handlePasswordRegister : handlePasskeyRegister}
              className="space-y-3.5"
            >
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Nome de Herói
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="name"
                    placeholder="Como prefere ser chamado?"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value);
                      clearError();
                    }}
                    disabled={isBusy}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      clearError();
                    }}
                    disabled={isBusy}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {!regUsePasswordInstead ? (
                <>
                  <div>
                    <label
                      htmlFor="reg-passkey-name"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Nome desta Passkey <span className="text-slate-500 font-normal">(para identificar depois)</span>
                    </label>
                    <div className="relative">
                      <Laptop className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-passkey-name"
                        type="text"
                        maxLength={60}
                        placeholder="Ex: MacBook Touch ID, iPhone..."
                        value={regPasskeyName}
                        onChange={(e) => setRegPasskeyName(e.target.value)}
                        disabled={isBusy}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Onde salvar a Passkey
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'any', label: 'Automático', icon: Sparkles },
                          { id: 'platform', label: 'Este aparelho', icon: Laptop },
                          { id: 'cross-platform', label: 'Celular / USB', icon: Smartphone },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = regAttachment === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isBusy}
                            onClick={() => setRegAttachment(opt.id)}
                            className={`py-2 px-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1 transition-all ${
                              active
                                ? 'bg-violet-500/20 border-violet-500 text-violet-200'
                                : 'bg-[#0B0F19] border-[#1E293B] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy || !passkeySupport.supported}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-violet-500/25 transition-all active:scale-[0.98]"
                  >
                    {busyAction === 'passkey-register' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Criando conta com Passkey...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5" />
                        <span>Criar Conta com Passkey</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Senha <span className="text-slate-500 font-normal">(mín. 8 caracteres)</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Crie uma senha segura"
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          clearError();
                        }}
                        disabled={isBusy}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password-confirm"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="reg-password-confirm"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Repita a senha"
                        value={regPasswordConfirm}
                        onChange={(e) => {
                          setRegPasswordConfirm(e.target.value);
                          clearError();
                        }}
                        disabled={isBusy}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 transition-all active:scale-[0.98]"
                  >
                    {busyAction === 'password-register' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Criando conta...</span>
                      </>
                    ) : (
                      <>
                        <span>Criar Conta com Senha</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}

              {passkeySupport.supported && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setRegUsePasswordInstead((v) => !v);
                    clearError();
                  }}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-violet-300 pt-1 transition-colors"
                >
                  {regUsePasswordInstead
                    ? '← Voltar e criar direto com Passkey (recomendado)'
                    : 'Prefere criar com senha e configurar a Passkey depois?'}
                </button>
              )}
            </form>
          )}
        </div>

        {/* Educational Footer */}
        <div className="bg-[#131A2A]/60 border border-[#1E293B]/80 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200">Por que Passkeys?</strong> Use Touch ID, Face ID,
            Windows Hello ou sua chave de segurança. Sem senhas para esquecer — e você pode
            adicionar vários dispositivos ou definir uma senha de recuperação nas configurações da
            sua conta.
          </div>
        </div>
      </div>
    </div>
  );
};
