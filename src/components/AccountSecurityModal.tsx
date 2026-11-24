import React, { useEffect, useState } from 'react';
import {
  X,
  Fingerprint,
  Plus,
  Trash2,
  Pencil,
  Check,
  ShieldCheck,
  KeyRound,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Cloud,
  Laptop,
  Smartphone,
  Sparkles,
  User,
  Lock,
} from 'lucide-react';
import type { AuthUser, PasskeyInfo } from '../types';
import {
  addPasskeyToAccount,
  checkPasskeySupport,
  deletePasskey,
  getSuggestedDeviceName,
  listPasskeys,
  removePassword,
  renamePasskey,
  setOrChangePassword,
  translateWebAuthnError,
  updateProfile,
} from '../services/api';

interface AccountSecurityModalProps {
  isOpen: boolean;
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => Promise<void>;
  onNotify: (title: string, subtitle: string, type?: 'reward' | 'boss' | 'combo' | 'info') => void;
}

function formatDatePtBr(iso: string | null): string {
  if (!iso) return 'Ainda não usada';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  user,
  onClose,
  onUserUpdated,
  onLogout,
  onNotify,
}) => {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);

  // Add passkey form
  const [newPasskeyName, setNewPasskeyName] = useState(() => getSuggestedDeviceName());
  const [newAttachment, setNewAttachment] = useState<'any' | 'platform' | 'cross-platform'>('any');
  const [addingPasskey, setAddingPasskey] = useState(false);

  // Inline rename
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState('');
  const [busyPasskeyId, setBusyPasskeyId] = useState<string | null>(null);

  // Profile form
  const [displayName, setDisplayName] = useState(user.displayName);
  const [savingProfile, setSavingProfile] = useState(false);

  // Fallback password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(user.displayName);
    setErrorMsg(null);
    setSuccessMsg(null);
    setNewPasskeyName(getSuggestedDeviceName());

    checkPasskeySupport().then(({ supported }) => setPasskeySupported(supported));

    setLoadingPasskeys(true);
    listPasskeys()
      .then((list) => setPasskeys(list))
      .catch((err) => setErrorMsg(translateWebAuthnError(err)))
      .finally(() => setLoadingPasskeys(false));
  }, [isOpen, user.displayName]);

  if (!isOpen) return null;

  const clearAlerts = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleAddPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setAddingPasskey(true);
    try {
      const { passkey, passkeysCount } = await addPasskeyToAccount({
        passkeyName: newPasskeyName.trim() || getSuggestedDeviceName(),
        authenticatorAttachment: newAttachment === 'any' ? undefined : newAttachment,
      });
      setPasskeys((prev) => [passkey, ...prev]);
      onUserUpdated({ ...user, passkeysCount });
      setNewPasskeyName(getSuggestedDeviceName());
      setSuccessMsg(`Passkey "${passkey.name}" configurada com sucesso!`);
      onNotify(
        '🔐 Nova Passkey Configurada!',
        `"${passkey.name}" já pode ser usada para entrar em 1 clique.`,
        'info'
      );
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setAddingPasskey(false);
    }
  };

  const handleSaveRename = async (id: string) => {
    clearAlerts();
    const trimmed = editingPasskeyName.trim();
    if (!trimmed) {
      setErrorMsg('Informe um nome válido para a Passkey.');
      return;
    }
    setBusyPasskeyId(id);
    try {
      const updated = await renamePasskey(id, trimmed);
      setPasskeys((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingPasskeyId(null);
      setSuccessMsg('Nome da Passkey atualizado.');
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setBusyPasskeyId(null);
    }
  };

  const handleDeletePasskey = async (pk: PasskeyInfo) => {
    clearAlerts();
    setBusyPasskeyId(pk.id);
    try {
      const { passkeysCount } = await deletePasskey(pk.id);
      setPasskeys((prev) => prev.filter((p) => p.id !== pk.id));
      onUserUpdated({ ...user, passkeysCount });
      setSuccessMsg(`Passkey "${pk.name}" removida.`);
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setBusyPasskeyId(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (displayName.trim().length < 2) {
      setErrorMsg('O nome de herói precisa ter pelo menos 2 caracteres.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateProfile(displayName.trim());
      onUserUpdated(updated);
      setSuccessMsg('Nome de herói atualizado!');
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (newPassword.length < 8) {
      setErrorMsg('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas não conferem.');
      return;
    }
    setSavingPassword(true);
    try {
      const updated = await setOrChangePassword({
        currentPassword: user.hasPassword ? currentPassword : undefined,
        newPassword,
      });
      onUserUpdated(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setSuccessMsg(
        user.hasPassword
          ? 'Senha de recuperação alterada com sucesso!'
          : 'Senha de recuperação configurada com sucesso!'
      );
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRemovePassword = async () => {
    clearAlerts();
    setSavingPassword(true);
    try {
      const updated = await removePassword();
      onUserUpdated(updated);
      setShowPasswordForm(false);
      setSuccessMsg('Senha removida. Sua conta agora usa 100% Passkey.');
    } catch (err) {
      setErrorMsg(translateWebAuthnError(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  const canDeleteAnyPasskey = passkeys.length > 1 || user.hasPassword;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#131A2A] border border-[#1E293B] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1E293B] flex items-center justify-between bg-[#0B0F19]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Conta & Configuração de Passkeys
              </h2>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1E293B] transition-colors"
            aria-label="Fechar configurações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* =============================================================== */}
          {/* SECTION 1: PASSKEYS                                             */}
          {/* =============================================================== */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-violet-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Minhas Passkeys ({passkeys.length})
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                WebAuthn / FIDO2
              </span>
            </div>

            {/* Passkey List */}
            {loadingPasskeys ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                <span>Carregando suas Passkeys...</span>
              </div>
            ) : passkeys.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-amber-200">
                Você ainda não cadastrou nenhuma Passkey. Adicione uma abaixo para entrar com
                biometria ou chave de segurança sem digitar senha!
              </div>
            ) : (
              <div className="space-y-2.5">
                {passkeys.map((pk) => {
                  const isEditing = editingPasskeyId === pk.id;
                  const isBusy = busyPasskeyId === pk.id;
                  return (
                    <div
                      key={pk.id}
                      className="p-3.5 rounded-2xl bg-[#0B0F19] border border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-xl bg-violet-500/15 text-violet-400 flex-shrink-0">
                          {pk.backedUp || pk.deviceType === 'multiDevice' ? (
                            <Cloud className="w-4 h-4" />
                          ) : (
                            <Fingerprint className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingPasskeyName}
                                maxLength={60}
                                onChange={(e) => setEditingPasskeyName(e.target.value)}
                                className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-[#131A2A] border border-violet-500 text-sm text-white focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSaveRename(pk.id)}
                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                title="Salvar nome"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPasskeyId(null)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-white truncate">
                                {pk.name}
                              </span>
                              {pk.backedUp && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  Sincronizada
                                </span>
                              )}
                            </div>
                          )}

                          <p className="text-[11px] text-slate-400 mt-1">
                            Criada em {formatDatePtBr(pk.createdAt)} · Último uso:{' '}
                            <span className="text-slate-300">{formatDatePtBr(pk.lastUsedAt)}</span>
                          </p>
                        </div>
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setEditingPasskeyId(pk.id);
                              setEditingPasskeyName(pk.name);
                              clearAlerts();
                            }}
                            className="p-2 rounded-xl bg-[#131A2A] border border-[#1E293B] text-slate-400 hover:text-white hover:border-violet-500/40 transition-colors"
                            title="Renomear Passkey"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isBusy || !canDeleteAnyPasskey}
                            onClick={() => handleDeletePasskey(pk)}
                            className="p-2 rounded-xl bg-[#131A2A] border border-[#1E293B] text-slate-400 hover:text-rose-400 hover:border-rose-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title={
                              canDeleteAnyPasskey
                                ? 'Remover Passkey'
                                : 'Adicione outra Passkey ou defina uma senha antes de remover sua última Passkey'
                            }
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add New Passkey Form */}
            {passkeySupported && (
              <form
                onSubmit={handleAddPasskey}
                className="p-4 rounded-2xl bg-[#0B0F19]/80 border border-violet-500/25 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-violet-300 uppercase tracking-wider">
                  <Plus className="w-4 h-4" />
                  <span>Adicionar nova Passkey</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="add-passkey-name"
                      className="block text-[11px] font-semibold text-slate-400 mb-1"
                    >
                      Nome do dispositivo / chave
                    </label>
                    <input
                      id="add-passkey-name"
                      type="text"
                      maxLength={60}
                      value={newPasskeyName}
                      onChange={(e) => setNewPasskeyName(e.target.value)}
                      placeholder="Ex: iPhone Face ID, YubiKey..."
                      disabled={addingPasskey}
                      className="w-full px-3 py-2 rounded-xl bg-[#131A2A] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Tipo de autenticador
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'any', label: 'Auto', icon: Sparkles },
                          { id: 'platform', label: 'Local', icon: Laptop },
                          { id: 'cross-platform', label: 'Externo', icon: Smartphone },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = newAttachment === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={addingPasskey}
                            onClick={() => setNewAttachment(opt.id)}
                            className={`py-2 px-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                              active
                                ? 'bg-violet-500/20 border-violet-500 text-violet-200'
                                : 'bg-[#131A2A] border-[#1E293B] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addingPasskey}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:from-[#7C3AED] hover:to-[#4F46E5] disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  {addingPasskey ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Aguardando confirmação do dispositivo...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4" />
                      <span>Registrar Passkey agora</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </section>

          {/* =============================================================== */}
          {/* SECTION 2: FALLBACK PASSWORD                                    */}
          {/* =============================================================== */}
          <section className="pt-4 border-t border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Senha de Recuperação (Fallback)</h3>
                  <p className="text-xs text-slate-400">
                    {user.hasPassword
                      ? 'Ativa — você pode entrar por senha se estiver sem sua Passkey.'
                      : 'Desativada — conta protegida exclusivamente por Passkey.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm((v) => !v);
                  clearAlerts();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] hover:border-violet-500/40 text-xs font-bold text-slate-200 transition-colors flex-shrink-0"
              >
                {showPasswordForm
                  ? 'Cancelar'
                  : user.hasPassword
                  ? 'Alterar senha'
                  : 'Definir senha'}
              </button>
            </div>

            {showPasswordForm && (
              <form
                onSubmit={handleSavePassword}
                className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1E293B] space-y-3"
              >
                {user.hasPassword && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Senha atual
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#131A2A] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nova senha (mín. 8 caracteres)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#131A2A] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#131A2A] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2"
                  >
                    {savingPassword ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    <span>Salvar senha</span>
                  </button>

                  {user.hasPassword && passkeys.length >= 1 && (
                    <button
                      type="button"
                      disabled={savingPassword}
                      onClick={handleRemovePassword}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/10 transition-colors"
                    >
                      Remover senha (ficar 100% Passkey)
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* =============================================================== */}
          {/* SECTION 3: PROFILE & LOGOUT                                     */}
          {/* =============================================================== */}
          <section className="pt-4 border-t border-[#1E293B] space-y-3">
            <form onSubmit={handleUpdateProfile} className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1">
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Nome de Herói</span>
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  minLength={2}
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0B0F19] border border-[#1E293B] focus:border-violet-500 focus:outline-none text-sm text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={savingProfile || displayName.trim() === user.displayName}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold h-[38px] transition-colors"
                >
                  {savingProfile ? 'Salvando...' : 'Atualizar nome'}
                </button>
              </div>
            </form>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Dados salvos automaticamente no banco PostgreSQL (Neon).
              </span>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogoutClick}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {loggingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>Sair da conta</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
