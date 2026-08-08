'use client';

import { useState, useEffect } from 'react';
import { db, Profile, SystemNotification } from '@/lib/db';
import Link from 'next/link';
import {
  Mail, Send, AlertOctagon, Info, CheckCircle2, User,
  Clock, Trash2, ShieldAlert, FileText, ExternalLink,
  Sparkles, CreditCard, Landmark, UserPlus, Bell, RefreshCw
} from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';

export default function TeamInboxPage() {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<SystemNotification | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Compose broadcast states
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<SystemNotification['category']>('broadcast');
  const [targetRole, setTargetRole] = useState<string>('all');
  const [sending, setSending] = useState(false);

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

  const loadInboxData = async () => {
    try {
      const u = await db.getCurrentUser();
      setCurrentUser(u);
      const list = await db.getSystemNotifications(u.role_name, u.id);
      setNotifications(list);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInboxData();
  }, []);

  const handleSelectNotif = async (notif: SystemNotification) => {
    setSelectedNotif(notif);
    if (currentUser && !notif.read_by.includes(currentUser.id)) {
      await db.markNotificationRead(notif.id, currentUser.id);
      await loadInboxData();
    }
  };

  const handleClearSingleNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await db.deleteNotification(id);
      if (selectedNotif?.id === id) {
        setSelectedNotif(null);
      }
      await loadInboxData();
      showModal('Cleared', 'Notification removed from inbox.', 'success');
    } catch (err) {
      showModal('Error', 'Failed to clear notification.', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all notifications from your inbox?')) return;
    try {
      await db.clearAllNotifications();
      setSelectedNotif(null);
      await loadInboxData();
      showModal('Cleared All', 'All inbox notifications cleared successfully.', 'success');
    } catch (err) {
      showModal('Error', 'Failed to clear notifications.', 'error');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showModal('Validation Error', 'Title and message fields are required.', 'error');
      return;
    }
    setSending(true);

    try {
      await db.notifyAction({
        sender_name: currentUser?.full_name || 'System Admin',
        sender_role: currentUser?.role_name || 'Super Admin',
        title: title.trim(),
        message: message.trim(),
        category,
        target_roles: targetRole === 'all' ? ['Super Admin', 'Finance Admin', 'Client Service', 'Project Manager'] : [targetRole]
      });

      setTitle('');
      setMessage('');
      setCategory('broadcast');
      await loadInboxData();
      showModal('Broadcast Sent', 'Your communication announcement has been published.', 'success');
    } catch (err) {
      showModal('Broadcast Failed', 'Failed to publish communication.', 'error');
    } finally {
      setSending(false);
    }
  };

  const getCategoryIcon = (cat: SystemNotification['category']) => {
    switch (cat) {
      case 'invoice_created': return <FileText className="h-4 w-4 text-blue-600" />;
      case 'approval_required': return <Clock className="h-4 w-4 text-amber-600" />;
      case 'invoice_approved': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'payment_recorded': return <CreditCard className="h-4 w-4 text-emerald-600" />;
      case 'tax_recorded': return <Landmark className="h-4 w-4 text-purple-600" />;
      case 'client_added': return <UserPlus className="h-4 w-4 text-indigo-600" />;
      case 'emergency': return <AlertOctagon className="h-4 w-4 text-red-600" />;
      default: return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const unreadCount = currentUser ? notifications.filter(n => !n.read_by.includes(currentUser.id)).length : 0;
  const emergencyCount = notifications.filter(n => n.category === 'emergency').length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Role-Based System Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time dynamic activity notifications, approval alerts, and broadcast communications
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <RefreshCw className="h-3 w-3 text-amber-600" />
            <span>48-Hour Auto Clean Active</span>
          </span>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center space-x-1.5 text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 rounded-xl px-3 py-1.5 hover:bg-red-50 transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4 flex items-center space-x-3.5 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Notifications</span>
            <p className="text-2xl font-extrabold text-gray-900">{notifications.length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#100e09]/15 bg-[#100e09]/4 p-4 flex items-center space-x-3.5 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-[#100e09]/10 flex items-center justify-center text-[#100e09] shrink-0">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#100e09] block tracking-wider">Unread Action Alerts</span>
            <p className="text-2xl font-extrabold text-[#100e09]">{unreadCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex items-center space-x-3.5 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-800 block tracking-wider">High Priority Alerts</span>
            <p className="text-2xl font-extrabold text-amber-800">{emergencyCount}</p>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Notification List & Broadcast Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Notification List */}
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <h3 className="font-bold text-sm text-gray-900 flex items-center space-x-2">
                <Bell className="h-4 w-4 text-[#100e09]" />
                <span>Inbox Activity Feed</span>
              </h3>
              <span className="text-[11px] text-gray-400 font-medium">Logged in as: {currentUser?.role_name || 'User'}</span>
            </div>
            
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400 space-y-2">
                <Mail className="h-8 w-8 mx-auto text-gray-300" />
                <p className="font-semibold text-gray-600">Your role inbox is clean and up to date.</p>
                <p className="text-xs text-gray-400">Notifications automatically clean up after 48 hours.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {notifications.map((notif) => {
                  const isSelected = selectedNotif?.id === notif.id;
                  const isRead = currentUser ? notif.read_by.includes(currentUser.id) : false;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleSelectNotif(notif)}
                      className={`p-4 rounded-xl border transition cursor-pointer flex gap-3 justify-between items-start ${
                        isSelected ? 'ring-2 ring-[#100e09]/20 border-[#100e09]' : 'border-gray-150 hover:bg-gray-50/80'
                      } ${!isRead ? 'bg-amber-50/30 font-bold border-amber-200/80' : 'bg-[#f5f4eb]'}`}
                    >
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <div className="mt-0.5 p-2 rounded-lg bg-gray-50 border border-gray-100 shrink-0">
                          {getCategoryIcon(notif.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            {!isRead && (
                              <span className="w-2 h-2 rounded-full bg-[#100e09] shrink-0" />
                            )}
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                              {notif.sender_name} ({notif.sender_role})
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-gray-900 mt-0.5 truncate">{notif.title}</h4>
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate font-normal">{notif.message}</p>
                          
                          {notif.link_url && (
                            <Link
                              href={notif.link_url}
                              className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#100e09] hover:underline mt-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>View Related Record</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[9px] text-gray-400 font-mono">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleClearSingleNotif(notif.id, e)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                          title="Clear notification"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Broadcast/Compose Form for Management Roles */}
          {currentUser && (currentUser.role_name === 'Super Admin' || currentUser.role_name === 'Admin' || currentUser.role_name === 'Finance Admin') && (
            <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-sm text-gray-900 border-b border-gray-50 pb-3 flex items-center space-x-2">
                <Send className="h-4 w-4 text-[#100e09]" />
                <span>Broadcast System Announcement</span>
              </h3>

              <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Announcement Header</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. End of Month Financial Reconciliation Notice"
                      className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Target Roles</label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:outline-none cursor-pointer font-semibold"
                    >
                      <option value="all">All Organization Roles</option>
                      <option value="Super Admin">Super Admin Only</option>
                      <option value="Finance Admin">Finance Admin Only</option>
                      <option value="Client Service">Client Service Only</option>
                      <option value="Project Manager">Project Managers Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Announcement Message Body</label>
                  <textarea
                    required
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details regarding operational rules, billing audits, or policy updates..."
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none resize-y"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex items-center space-x-2 rounded-xl bg-[#100e09] py-2 px-5 font-bold text-[#f5f4eb] hover:bg-[#7d1219] shadow-md cursor-pointer transition disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Publish Broadcast</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Side: Notification Detail Inspector */}
        <div className="lg:col-span-5">
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 min-h-[340px] flex flex-col justify-between shadow-sm">
            {selectedNotif ? (
              <div className="space-y-6">
                
                {/* Meta details */}
                <div className="border-b border-gray-100 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-700">
                        {getCategoryIcon(selectedNotif.category)}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 text-xs block">{selectedNotif.sender_name}</span>
                        <span className="text-[10px] text-gray-400 font-semibold uppercase">{selectedNotif.sender_role}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleClearSingleNotif(selectedNotif.id, e)}
                      className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                      title="Clear Notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-mono">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(selectedNotif.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-sm text-gray-900 leading-snug">{selectedNotif.title}</h4>
                  
                  <div className="text-xs text-gray-700 leading-relaxed bg-gray-50/80 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap font-normal">
                    {selectedNotif.message}
                  </div>
                </div>

                {/* Direct Action Link */}
                {selectedNotif.link_url && (
                  <div className="pt-2">
                    <Link
                      href={selectedNotif.link_url}
                      className="w-full flex items-center justify-center space-x-2 rounded-xl bg-[#100e09] py-2.5 px-4 font-bold text-[#f5f4eb] text-xs hover:bg-[#7d1219] shadow-sm transition"
                    >
                      <span>Open Associated Document</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}

                {selectedNotif.category === 'emergency' && (
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 flex items-start space-x-2.5 text-[11px] text-red-900 font-medium">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-[#100e09] mt-0.5" />
                    <span>High priority security announcement. Follow organizational compliance procedures immediately.</span>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-gray-400">
                <Mail className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-xs font-semibold text-gray-600">Select any notification to inspect details</p>
                <p className="text-[11px] text-gray-400 mt-1">Direct links allow immediate record navigation</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Notification Modal */}
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
