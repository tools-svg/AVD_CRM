import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Plus, 
  Clock, 
  CheckCircle2, 
  CreditCard, 
  AlertCircle,
  FileText,
  Calendar,
  Trash2
} from 'lucide-react';
import { ProjectFinanceRecord, ProjectPaymentRecord, PaymentStatus } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

interface ProjectFinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectTitle: string;
  onUpdated: () => void;
}

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Credit Card',
  'Cheque',
  'Cash',
  'UPI',
  'Other'
];

const STATUS_OPTIONS: PaymentStatus[] = [
  'Quoted',
  '50% Received',
  'Partially Received',
  'Fully Received',
  'On Hold',
  'Overdue',
  'Cancelled'
];

export const ProjectFinanceModal: React.FC<ProjectFinanceModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  onUpdated
}) => {
  const { user } = useAuth();
  const { showNotification } = useNotifications();

  const [finance, setFinance] = useState<ProjectFinanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'record_payment' | 'history' | 'settings'>('record_payment');

  // Payment form state
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Settings form state
  const [quotedAmount, setQuotedAmount] = useState<string>('0');
  const [currency, setCurrency] = useState<string>('₹');
  const [status, setStatus] = useState<string>('Quoted');
  const [financeNotes, setFinanceNotes] = useState<string>('');
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);

  const loadFinanceDetails = async () => {
    setLoading(true);
    try {
      const data = await api.getProjectFinance(projectId);
      setFinance(data);
      setQuotedAmount(data.quoted_amount.toString());
      setCurrency(data.currency || '₹');
      setStatus(data.status);
      setFinanceNotes(data.notes || '');
    } catch (err: any) {
      showNotification({
        title: 'Error loading finances',
        message: err.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      loadFinanceDetails();
      setAmount('');
      setReferenceNumber('');
      setPaymentNotes('');
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showNotification({
        title: 'Invalid Amount',
        message: 'Payment amount must be greater than zero.',
        type: 'warning'
      });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await api.recordPayment(projectId, {
        amount: numAmount,
        payment_date: new Date(paymentDate).toISOString(),
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined
      });

      showNotification({
        title: 'Payment Recorded',
        message: `Successfully recorded payment of ${finance?.currency || '₹'}${numAmount.toLocaleString()} for ${projectTitle}.`,
        type: 'success',
        persist: true
      });

      setAmount('');
      setReferenceNumber('');
      setPaymentNotes('');
      await loadFinanceDetails();
      onUpdated();
      setActiveTab('history');
    } catch (err: any) {
      showNotification({
        title: 'Payment Failed',
        message: err.message || 'Could not record payment',
        type: 'error'
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQuoted = parseFloat(quotedAmount);
    if (isNaN(numQuoted) || numQuoted < 0) {
      showNotification({
        title: 'Invalid Quoted Amount',
        message: 'Quoted amount cannot be negative.',
        type: 'warning'
      });
      return;
    }

    setIsSubmittingSettings(true);
    try {
      await api.updateProjectFinance(projectId, {
        quoted_amount: numQuoted,
        currency: currency.trim() || '₹',
        status: status,
        notes: financeNotes.trim() || undefined
      });

      showNotification({
        title: 'Finances Updated',
        message: 'Project financial settings have been saved.',
        type: 'success'
      });

      await loadFinanceDetails();
      onUpdated();
    } catch (err: any) {
      showNotification({
        title: 'Update Failed',
        message: err.message,
        type: 'error'
      });
    } finally {
      setIsSubmittingSettings(false);
    }
  };

  const handleVoidPayment = async (paymentId: number, paymentAmount: number) => {
    if (!['Developer', 'Director'].includes(user?.role_name || '')) {
      showNotification({
        title: 'Access Restricted',
        message: 'Only Developer or Director can void payment records.',
        type: 'warning'
      });
      return;
    }

    if (!confirm(`Void payment of ${finance?.currency || '₹'}${paymentAmount}? This transaction will be removed from financial ledgers.`)) {
      return;
    }

    try {
      await api.voidPayment(paymentId);
      showNotification({
        title: 'Payment Voided',
        message: 'Payment record has been removed and balance updated.',
        type: 'info'
      });
      await loadFinanceDetails();
      onUpdated();
    } catch (err: any) {
      showNotification({
        title: 'Void Failed',
        message: err.message,
        type: 'error'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5">
      <div className="bg-[#FFFFFF] rounded-[18px] shadow-2xl border border-[#E1DCDC] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#E1DCDC] bg-[#0A0A0A] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-5 h-5 text-[#43866B]" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Project Financial Tracking</h2>
              <p className="text-[11px] text-white/70 truncate max-w-md">
                {projectTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[8px] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Highlights Bar */}
        {finance && (
          <div className="bg-[#F5F3F4] px-6 py-3 border-b border-[#E1DCDC] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#888888] block">Quoted Amount</span>
              <span className="text-sm font-extrabold text-[#111827]">
                {finance.currency} {finance.quoted_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#2F614E] block">Amount Received</span>
              <span className="text-sm font-extrabold text-[#2F614E]">
                {finance.currency} {finance.total_received.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#A93232] block">Remaining Balance</span>
              <span className="text-sm font-extrabold text-[#A93232]">
                {finance.currency} {finance.remaining_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#5269A8] block">Collection Status</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCE4FA] text-[#5269A8]">
                {finance.status}
              </span>
            </div>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="bg-[#FFFFFF] border-b border-[#E1DCDC] px-6 flex items-center space-x-2">
          {[
            { id: 'record_payment', label: 'Record Payment', icon: Plus },
            { id: 'history', label: `Payment History (${finance?.payment_count || 0})`, icon: Clock },
            { id: 'settings', label: 'Financial Details & Status', icon: FileText },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
                  activeTab === t.id
                    ? 'border-[#0A0A0A] text-[#0A0A0A]'
                    : 'border-transparent text-[#888888] hover:text-[#333333]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 p-6 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#888888]">Loading financial ledger...</div>
          ) : (
            <>
              {/* TAB 1: Record Payment */}
              {activeTab === 'record_payment' && (
                <form onSubmit={handleRecordPayment} className="space-y-4 max-w-lg mx-auto">
                  <div className="bg-[#F5F3F4] p-3 rounded-[10px] border border-[#E1DCDC] text-xs text-[#666666]">
                    Record a received payment. The remaining balance and collection status will automatically update.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#333333] mb-1">
                        Payment Amount ({finance?.currency || '₹'}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="e.g. 50000"
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#0A0A0A] font-semibold focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#333333] mb-1">
                        Payment Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#333333] mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-2 text-xs text-[#0A0A0A] focus:outline-none cursor-pointer"
                      >
                        {PAYMENT_METHODS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#333333] mb-1">
                        Transaction Ref / Cheque No.
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={e => setReferenceNumber(e.target.value)}
                        placeholder="e.g. TXN-99824"
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#333333] mb-1">
                      Notes / Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={paymentNotes}
                      onChange={e => setPaymentNotes(e.target.value)}
                      placeholder="Optional details regarding this installment..."
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] p-2.5 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A] resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="px-5 py-2 rounded-[10px] bg-[#0A0A0A] hover:bg-[#333333] text-white text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isSubmittingPayment ? 'Recording...' : 'Submit Payment'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: Payment History Ledger */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#888888]">
                    <span>Total recorded transactions: {finance?.payments.length || 0}</span>
                  </div>

                  {(!finance?.payments || finance.payments.length === 0) ? (
                    <div className="p-8 text-center text-xs text-[#888888] bg-[#F5F3F4] rounded-[12px] border border-[#E1DCDC]">
                      No payment records found for this project. Use "Record Payment" to log received funds.
                    </div>
                  ) : (
                    <div className="bg-white rounded-[12px] border border-[#E1DCDC] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F5F3F4] border-b border-[#E1DCDC] text-[10px] uppercase font-bold text-[#888888]">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Amount</th>
                            <th className="py-2.5 px-3">Method</th>
                            <th className="py-2.5 px-3">Reference</th>
                            <th className="py-2.5 px-3">Recorded By</th>
                            {['Developer', 'Director'].includes(user?.role_name || '') && (
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F3F4]">
                          {finance.payments.map(p => (
                            <tr key={p.id} className="hover:bg-[#F9F9F9] transition-colors">
                              <td className="py-2.5 px-3 whitespace-nowrap text-[#333333]">
                                {new Date(p.payment_date).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-[#2F614E] whitespace-nowrap">
                                {finance.currency} {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-[#555555]">
                                {p.payment_method || 'Bank Transfer'}
                              </td>
                              <td className="py-2.5 px-3 text-[#666666] font-mono text-[11px]">
                                {p.reference_number || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-[#888888] text-[11px]">
                                {p.recorded_by_name || 'System'}
                              </td>
                              {['Developer', 'Director'].includes(user?.role_name || '') && (
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleVoidPayment(p.id, p.amount)}
                                    className="p-1 rounded text-[#888888] hover:text-[#A93232] hover:bg-[#F5DEDE]/40"
                                    title="Void payment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Financial Details & Status */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-4 max-w-lg mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#333333] mb-1">
                        Quoted Project Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={quotedAmount}
                        onChange={e => setQuotedAmount(e.target.value)}
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#0A0A0A] font-semibold focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#333333] mb-1">
                        Currency Symbol / Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        placeholder="e.g. ₹, $, USD, EUR"
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#333333] mb-1">
                      Collection / Payment Status *
                    </label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-2 text-xs text-[#0A0A0A] focus:outline-none cursor-pointer"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[#888888] mt-1">
                      Note: Setting '50% Received' requires actual payments received to be at least 50% of the quoted value.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#333333] mb-1">
                      Commercial Terms & Notes
                    </label>
                    <textarea
                      rows={3}
                      value={financeNotes}
                      onChange={e => setFinanceNotes(e.target.value)}
                      placeholder="Billing milestones, payment terms, or client finance agreements..."
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] p-2.5 text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A] resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingSettings}
                      className="px-5 py-2 rounded-[10px] bg-[#0A0A0A] hover:bg-[#333333] text-white text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isSubmittingSettings ? 'Saving...' : 'Save Financial Details'}</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

