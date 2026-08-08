'use client';

import { useState, useEffect } from 'react';
import { db, Profile, AuditLog } from '@/lib/db';
import {
  Shield, Users, Terminal, UserCog, UserPlus, Trash2,
  X, Eye, EyeOff, Key, Download, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';

// Password hash (SHA-256 via Web Crypto API)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
  isValid: boolean;
}

function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    isValid: password.length >= 12 &&
             /[A-Z]/.test(password) &&
             /[a-z]/.test(password) &&
             /[0-9]/.test(password) &&
             /[^A-Za-z0-9]/.test(password)
  };
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  const reqs = getPasswordRequirements(password);
  let score = 0;
  if (password.length >= 8) score++;
  if (reqs.length) score++;
  if (reqs.uppercase) score++;
  if (reqs.number) score++;
  if (reqs.special) score++;

  if (score <= 2) return { score, label: 'Weak (Vulnerable)', color: 'bg-red-500' };
  if (score === 3) return { score, label: 'Fair (Not recommended)', color: 'bg-amber-500' };
  if (score === 4) return { score, label: 'Good (Secure)', color: 'bg-blue-500' };
  return { score, label: 'Excellent (Very Secure)', color: 'bg-green-500' };
}

export default function TeamManagementPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible Audit Trail state
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Role Change Confirmation Modal state
  const [roleChangeModal, setRoleChangeModal] = useState<{
    userId: string;
    userName: string;
    oldRole: Profile['role_name'];
    newRole: Profile['role_name'];
  } | null>(null);

  // Create account modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Profile['role_name']>('Finance Admin');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showNewPassConfirm, setShowNewPassConfirm] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Edit account modal state (only for Super Admin)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPass, setShowEditPass] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  // Generic Notification Modal
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModalState({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    async function loadTeamData() {
      try {
        const u = await db.getCurrentUser();
        setCurrentUser(u);

        const list = await db.getProfiles();
        setProfiles(list);

        if (u && (u.role_name === 'Super Admin' || u.role_name === 'Admin')) {
          const logs = await db.getAuditLogs();
          setAuditLogs(logs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadTeamData();
  }, []);

  const requestRoleChange = (userId: string, userName: string, oldRole: Profile['role_name'], newRole: Profile['role_name']) => {
    if (oldRole === newRole) return;
    if (newRole === 'Super Admin' && currentUser?.role_name !== 'Super Admin') {
      showModal('Action Forbidden', 'Only Super Admins have permission to assign the Super Admin role.', 'error');
      return;
    }
    setRoleChangeModal({ userId, userName, oldRole, newRole });
  };

  const confirmRoleChange = async () => {
    if (!roleChangeModal) return;
    const { userId, userName, newRole } = roleChangeModal;
    try {
      await db.updateProfileRole(userId, newRole);
      const list = profiles.map(p => p.id === userId ? { ...p, role_name: newRole } : p);
      setProfiles(list);
      const logs = await db.getAuditLogs();
      setAuditLogs(logs);
      setRoleChangeModal(null);
      showModal('Role Updated Successfully', `User "${userName}" role has been changed to ${newRole}.`, 'success');
    } catch (err: any) {
      setRoleChangeModal(null);
      showModal('Update Failed', err.message || 'Role update failed.', 'error');
    }
  };

  const handleDeleteProfile = async (userId: string, userName: string, targetRole: Profile['role_name']) => {
    // Super Admin accounts are protected from deletion
    if (targetRole === 'Super Admin') {
      showModal('Action Forbidden', 'Super Admin accounts are permanently protected and cannot be deleted.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to permanently remove "${userName}" from the team?`)) return;
    try {
      await db.deleteProfile(userId);
      setProfiles(prev => prev.filter(p => p.id !== userId));
      const logs = await db.getAuditLogs();
      setAuditLogs(logs);
      showModal('Account Removed', `Team account for "${userName}" has been deleted.`, 'success');
    } catch (err: any) {
      showModal('Delete Failed', err.message || 'Deletion failed.', 'error');
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      showModal('Username Required', 'Please enter a unique username.', 'error');
      return;
    }
    if (profiles.some(p => p.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      showModal('Duplicate Account', 'A team member with this email address already exists.', 'error');
      return;
    }
    if (profiles.some(p => p.username && p.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      showModal('Username Taken', 'This username is already in use. Please enter a unique username.', 'error');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showModal('Password Mismatch', 'Passwords do not match. Please re-enter.', 'error');
      return;
    }
    const reqs = getPasswordRequirements(newPassword);
    if (!reqs.isValid) {
      showModal('Weak Password', 'Password does not meet the strict security checklist criteria. Simple/predictable passwords are strictly blocked to safeguard the system.', 'error');
      return;
    }

    setCreatingAccount(true);
    try {
      const hash = await hashPassword(newPassword);
      const profile = await db.createProfile({
        full_name: newFullName.trim(),
        username: newUsername.trim().toLowerCase(),
        email: newEmail.trim().toLowerCase(),
        role_name: newRole,
        password_hash: hash,
        password: newPassword
      });
      
      const updatedList = await db.getProfiles();
      setProfiles(updatedList);
      const logs = await db.getAuditLogs();
      setAuditLogs(logs);
      
      // Reset form
      setNewFullName('');
      setNewUsername('');
      setNewEmail('');
      setNewRole('Finance Admin');
      setNewPassword('');
      setNewPasswordConfirm('');
      setShowCreateModal(false);
      
      showModal('Account Created', `Team account for "${profile.full_name}" (@${profile.username}) has been created successfully. Password securely hashed with SHA-256.`, 'success');
    } catch (err: any) {
      showModal('Creation Failed', err.message || 'Account creation failed.', 'error');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    if (!editUsername.trim()) {
      showModal('Username Required', 'Please enter a unique username.', 'error');
      return;
    }

    setUpdatingAccount(true);
    try {
      let hash: string | undefined;
      if (editPassword) {
        const reqs = getPasswordRequirements(editPassword);
        if (!reqs.isValid) {
          showModal('Weak Password', 'Password does not meet the strict security checklist criteria. Simple/predictable passwords are strictly blocked to safeguard the system.', 'error');
          setUpdatingAccount(false);
          return;
        }
        hash = await hashPassword(editPassword);
      }

      await db.updateProfileCredentials(editingProfile.id, {
        full_name: editFullName.trim(),
        email: editEmail.trim().toLowerCase(),
        username: editUsername.trim().toLowerCase(),
        password_hash: hash
      });

      const updatedList = await db.getProfiles();
      setProfiles(updatedList);
      
      // If updating own profile, sync currentUser session state
      if (currentUser && editingProfile.id === currentUser.id) {
        const selfUpdated = updatedList.find(p => p.id === currentUser.id);
        if (selfUpdated) {
          await db.setCurrentUser(selfUpdated);
          setCurrentUser(selfUpdated);
        }
      }

      const logs = await db.getAuditLogs();
      setAuditLogs(logs);

      setEditingProfile(null);
      setEditPassword('');
      showModal('Account Updated', `Team account credentials updated successfully.`, 'success');
    } catch (err: any) {
      showModal('Update Failed', err.message || 'Credentials update failed.', 'error');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const exportAuditLogsCSV = () => {
    if (auditLogs.length === 0) return;
    const headers = ['Log ID', 'Timestamp', 'Operator ID', 'Module', 'Action', 'Mutated State Payload'];
    const rows = auditLogs.map(log => [
      log.id,
      log.timestamp,
      log.user_id,
      log.module,
      log.action,
      `"${JSON.stringify(log.new_value || {}).replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `app_Audit_Trail_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
  };

  if (loading || !currentUser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const isSuperAdmin = currentUser.role_name === 'Super Admin';
  const isAdmin = currentUser.role_name === 'Admin';
  const canManageTeam = isSuperAdmin || isAdmin;

  if (!canManageTeam) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4 text-center">
        <Shield className="h-12 w-12 text-[#100e09]" />
        <h1 className="text-xl font-bold text-gray-850">Access Restricted</h1>
        <p className="text-xs text-gray-400 max-w-sm">Team Management is restricted to Super Admin and Admin personnel only.</p>
      </div>
    );
  }

  const ROLE_COLORS: Record<string, string> = {
    'Super Admin': 'bg-[#100e09]/10 text-[#100e09] border-[#100e09]/20',
    'Admin': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'Finance Admin': 'bg-blue-50 text-blue-700 border-blue-100',
    'Client Service': 'bg-green-50 text-green-700 border-green-100',
    'Project Manager': 'bg-purple-50 text-purple-700 border-purple-100',
  };

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Team Management & Access Controls</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Configure team accounts, assign granular role permissions, and audit system integrity
          </p>
        </div>
        <button
          id="btn-create-team-account"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center space-x-2 rounded-xl bg-[#100e09] px-4 py-2.5 text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md cursor-pointer transition w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4" />
          <span>Create Team Account</span>
        </button>
      </div>

      {/* Team Members List Card */}
      <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-sm flex items-center space-x-2 border-b border-gray-50 pb-3">
          <Users className="h-4 w-4 text-[#100e09]" />
          <span>Authorized Team Accounts ({profiles.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((p) => {
            const isSelf = p.id === currentUser.id;
            const isTargetSuperAdmin = p.role_name === 'Super Admin';
            // Admin cannot edit/delete Super Admin
            const cannotTouch = isAdmin && isTargetSuperAdmin;

            return (
              <div key={p.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-850 truncate">{p.full_name}</span>
                      {p.username && (
                        <span className="text-xs font-mono text-gray-400">@{p.username}</span>
                      )}
                      {isSelf && (
                        <span className="text-[9px] uppercase font-bold text-[#100e09] bg-red-50 border border-red-100 rounded px-1.5 shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 shrink-0 ${ROLE_COLORS[p.role_name] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {p.role_name}
                      </span>
                      <span className="text-xs text-gray-400 truncate">{p.email}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1 font-mono text-green-600">
                        <Key className="h-3 w-3" />
                        <span>SHA-256 Secured</span>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-gray-400">Pass: ••••••••••••</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    {(isSuperAdmin || (isAdmin && !isTargetSuperAdmin)) && (
                      <button
                        onClick={() => {
                          setEditingProfile(p);
                          setEditFullName(p.full_name);
                          setEditUsername(p.username || '');
                          setEditEmail(p.email);
                          setEditPassword('');
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        title="Edit account credentials & password"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!isSelf && !cannotTouch && (
                      <button
                        onClick={() => handleDeleteProfile(p.id, p.full_name, p.role_name)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Remove team member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Role Selector with strict confirmation */}
                {!isSelf && !cannotTouch && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                    <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px] flex items-center space-x-1">
                      <UserCog className="h-3 w-3" />
                      <span>Access Role</span>
                    </span>
                    <select
                      value={p.role_name}
                      onChange={(e) => requestRoleChange(p.id, p.full_name, p.role_name, e.target.value as any)}
                      className="rounded border border-gray-200 bg-[#f5f4eb] py-1 px-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#100e09] cursor-pointer"
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="Admin">Admin (Executive Manager)</option>
                      <option value="Finance Admin">Finance Admin</option>
                      <option value="Client Service">Client Service</option>
                      <option value="Project Manager">Project Manager</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cryptographic Audit Trail (Collapsible & Secure) */}
      <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
        <div 
          onClick={() => setShowAuditLogs(!showAuditLogs)}
          className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition border-b border-gray-50"
        >
          <div className="flex items-center space-x-3">
            <Terminal className="h-5 w-5 text-[#100e09]" />
            <div>
              <h3 className="font-bold text-sm text-gray-900">Cryptographic Transaction Audit Trail</h3>
              <p className="text-xs text-gray-400 mt-0.5">Immutable audit logs of all security, payment, and ledger actions</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); exportAuditLogsCSV(); }}
                className="flex items-center space-x-1.5 rounded-lg border border-gray-200 bg-[#f5f4eb] px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-gray-500" />
                <span>Export Log (CSV)</span>
              </button>
            )}
            <div className="text-gray-400">
              {showAuditLogs ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>
        </div>

        {/* Collapsible content */}
        {showAuditLogs && (
          <div className="p-6 pt-4 space-y-4">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                <Terminal className="h-8 w-8 mx-auto text-gray-200 mb-2" />
                <p>No actions recorded in audit log yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                {auditLogs.map((log) => {
                  const operator = profiles.find(pr => pr.id === log.user_id)?.full_name || 'System';
                  const actionColors: Record<string, string> = {
                    create_invoice: 'bg-blue-100 text-blue-700',
                    approve_invoice: 'bg-green-100 text-green-700',
                    void_invoice: 'bg-red-100 text-red-700',
                    record_payment: 'bg-emerald-100 text-emerald-700',
                    create_team_account: 'bg-purple-100 text-purple-700',
                    delete_team_account: 'bg-red-100 text-red-700',
                    change_user_role: 'bg-amber-100 text-amber-700',
                    update_gateway_rates: 'bg-cyan-100 text-cyan-700',
                    update_from_email: 'bg-indigo-100 text-indigo-700',
                    update_entity: 'bg-gray-100 text-gray-700',
                    switch_role: 'bg-orange-100 text-orange-700',
                  };
                  const colorClass = actionColors[log.action] || 'bg-gray-100 text-gray-600';
                  return (
                    <div key={log.id} className="p-3 bg-gray-50/70 border border-gray-100 rounded-xl text-[11px] leading-relaxed space-y-1.5 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-center gap-2">
                        <span className={`inline-block uppercase tracking-wider font-bold text-[9px] px-2 py-0.5 rounded-full ${colorClass}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-400 font-mono text-[10px] shrink-0">{log.timestamp.replace('T', ' ').substring(0, 19)} UTC</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>Operator: <span className="font-bold text-gray-800">{operator}</span></span>
                        <span className="text-gray-300">•</span>
                        <span>Module: <span className="font-semibold">{log.module}</span></span>
                      </div>

                      {log.new_value && (
                        <div className="text-[10px] bg-[#f5f4eb] border border-gray-100 rounded-lg p-2 mt-1 font-mono overflow-x-auto max-w-full">
                          <span className="text-gray-400 font-semibold block text-[8px] uppercase mb-1">State Mutation Payload</span>
                          <span className="text-gray-600 break-all">{JSON.stringify(log.new_value)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role Change Confirmation Modal (Item #9) */}
      {roleChangeModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-[#100e09] border-b border-gray-100 pb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-base text-gray-900">Confirm Role Change</h3>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <p>
                Are you sure you want to change access role for <strong className="text-gray-900">{roleChangeModal.userName}</strong>?
              </p>
              
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1.5 font-semibold">
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Role:</span>
                  <span className="text-gray-700">{roleChangeModal.oldRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">New Role:</span>
                  <span className="text-[#100e09] font-extrabold">{roleChangeModal.newRole}</span>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 italic">
                This action will take effect immediately and will update their module access rights.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRoleChangeModal(null)}
                className="rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-4 font-semibold text-gray-700 hover:bg-gray-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRoleChange}
                className="rounded-xl bg-[#100e09] py-2 px-5 font-bold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md text-xs cursor-pointer transition"
              >
                Confirm Role Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <UserPlus className="h-5 w-5 text-[#100e09]" />
                <span>Create Team Account</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Lamia Nusny"
                  className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. lamia"
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. lamia@corevow.com"
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Access Role *</label>
                <select
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09] cursor-pointer"
                >
                  <option value="Finance Admin">Finance Admin</option>
                  <option value="Admin">Admin (Executive Manager)</option>
                  <option value="Client Service">Client Service</option>
                  <option value="Project Manager">Project Manager</option>
                  {isSuperAdmin && <option value="Super Admin">Super Admin</option>}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 12 chars, uppercase, number & symbol"
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 pr-10 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                  <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                    {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-2 space-y-2 p-3 rounded-xl bg-gray-50 border border-gray-150 text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-600">Password Security Rating:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[#f5f4eb] ${getPasswordStrength(newPassword).color}`}>
                        {getPasswordStrength(newPassword).label}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-gray-200/60">
                      <div className={getPasswordRequirements(newPassword).length ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Minimum 12 characters long
                      </div>
                      <div className={getPasswordRequirements(newPassword).uppercase ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains uppercase letter (A-Z)
                      </div>
                      <div className={getPasswordRequirements(newPassword).lowercase ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains lowercase letter (a-z)
                      </div>
                      <div className={getPasswordRequirements(newPassword).number ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains number (0-9)
                      </div>
                      <div className={getPasswordRequirements(newPassword).special ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains special symbol (@, #, $, etc.)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showNewPassConfirm ? 'text' : 'password'}
                    required
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Re-type password"
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 pr-10 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                  <button type="button" onClick={() => setShowNewPassConfirm(!showNewPassConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                    {showNewPassConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-4 font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="rounded-xl bg-[#100e09] py-2.5 px-6 font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md cursor-pointer transition disabled:opacity-50"
                >
                  {creatingAccount ? 'Creating...' : 'Create Account'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingProfile && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <UserCog className="h-5 w-5 text-[#100e09]" />
                <span>Edit Team Credentials</span>
              </h3>
              <button onClick={() => setEditingProfile(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 text-[11px] text-amber-800 leading-normal">
                Leave password blank if you do not want to change it.
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">New Password (Optional)</label>
                <div className="relative">
                  <input
                    type={showEditPass ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Min 12 chars, uppercase, number & symbol"
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 pr-10 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                  <button type="button" onClick={() => setShowEditPass(!showEditPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                    {showEditPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {editPassword && (
                  <div className="mt-2 space-y-2 p-3 rounded-xl bg-gray-50 border border-gray-150 text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-600">Password Security Rating:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[#f5f4eb] ${getPasswordStrength(editPassword).color}`}>
                        {getPasswordStrength(editPassword).label}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-gray-200/60">
                      <div className={getPasswordRequirements(editPassword).length ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Minimum 12 characters long
                      </div>
                      <div className={getPasswordRequirements(editPassword).uppercase ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains uppercase letter (A-Z)
                      </div>
                      <div className={getPasswordRequirements(editPassword).lowercase ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains lowercase letter (a-z)
                      </div>
                      <div className={getPasswordRequirements(editPassword).number ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains number (0-9)
                      </div>
                      <div className={getPasswordRequirements(editPassword).special ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                        ✓ Contains special symbol (@, #, $, etc.)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-4 font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingAccount}
                  className="rounded-xl bg-[#100e09] py-2.5 px-6 font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md cursor-pointer transition disabled:opacity-50"
                >
                  {updatingAccount ? 'Saving...' : 'Save Updates'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
      <NotificationModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />

    </div>
  );
}
