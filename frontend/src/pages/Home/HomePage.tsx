import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  ArrowUpRight, 
  Building2, 
  Trash2, 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  Layers,
  DollarSign,
  Wallet,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { GlobalNavbar } from '../../components/navigation/GlobalNavbar';
import { BackToTop } from '../../components/navigation/BackToTop';
import { StickyNotesPanel } from '../../components/sticky-notes/StickyNotesPanel';
import { InteractiveGantt } from '../../components/gantt/InteractiveGantt';
import { DeveloperUIEditorModal } from '../../components/modals/DeveloperUIEditorModal';
import { ProjectDeleteModal } from '../../components/modals/ProjectDeleteModal';
import { ProjectFinanceModal } from '../../components/modals/ProjectFinanceModal';
import { useAuth } from '../../context/AuthContext';
import { useUIConfig } from '../../context/UIConfigContext';
import { 
  ProjectItem, 
  DashboardStats, 
  Company, 
  ProjectFinanceDashboard, 
  ProjectFinanceRecord 
} from '../../types';
import { api } from '../../services/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../config/theme';
import { EditableUI } from '../../components/dev-editor/EditableUI';

const PAYMENT_STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  'Quoted': { bg: '#F3F4F6', text: '#4B5563' },
  'Partially Received': { bg: '#FEF3C7', text: '#D97706' },
  '50% Received': { bg: '#E0F2FE', text: '#0284C7' },
  'Fully Received': { bg: '#DCFCE7', text: '#16A34A' },
  'On Hold': { bg: '#F3E8FF', text: '#9333EA' },
  'Overdue': { bg: '#FEE2E2', text: '#DC2626' },
  'Cancelled': { bg: '#E5E7EB', text: '#6B7280' },
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, companies, selectedCompanyId } = useAuth();
  const { uiConfig } = useUIConfig();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Requirements 1 & 2: Mode Toggle (PROJECT | AMOUNT)
  const [dashboardMode, setDashboardMode] = useState<'project' | 'amount'>('project');
  const [financeDashboard, setFinanceDashboard] = useState<ProjectFinanceDashboard | null>(null);
  const [activeFinanceProject, setActiveFinanceProject] = useState<{ id: number; title: string } | null>(null);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);

  // GitHub-style deletion modal state
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);

  const isDirectorOrDev = ['Developer', 'Director', 'Project Manager'].includes(user?.role_name || '');
  const canAccessAmountMode = ['Developer', 'Director', 'Project Manager'].includes(user?.role_name || '');

  // Load dashboard statistics and projects
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const companyFilter = isDirectorOrDev ? undefined : (selectedCompanyId || undefined);
      const [statsData, projectsData] = await Promise.all([
        api.getStatistics(companyFilter),
        api.getProjects(companyFilter),
      ]);
      setStats(statsData);
      setProjects(projectsData);
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadFinanceData = async () => {
    if (!canAccessAmountMode) return;
    try {
      const companyFilter = isDirectorOrDev ? undefined : (selectedCompanyId || undefined);
      const data = await api.getFinances(companyFilter);
      setFinanceDashboard(data);
    } catch (e) {
      console.error('Error loading finances:', e);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedCompanyId, user?.role_name]);

  useEffect(() => {
    if (dashboardMode === 'amount' && canAccessAmountMode) {
      loadFinanceData();
    }
  }, [dashboardMode, selectedCompanyId, user?.role_name]);

  // Lookup map of project finance records
  const financesByProject = useMemo(() => {
    const map = new Map<number, ProjectFinanceRecord>();
    if (financeDashboard?.finances) {
      for (const f of financeDashboard.finances) {
        map.set(f.project_id, f);
      }
    }
    return map;
  }, [financeDashboard]);

  // Priority & Status Sorting Algorithm
  const sortProjects = (list: ProjectItem[]): ProjectItem[] => {
    const priorityRank: Record<string, number> = {
      Urgent: 1,
      High: 2,
      Medium: 3,
      Low: 4,
    };

    return [...list].sort((a, b) => {
      const isAClosedOrCancelled = a.status === 'Closed' || a.status === 'Cancelled';
      const isBClosedOrCancelled = b.status === 'Closed' || b.status === 'Cancelled';

      if (isAClosedOrCancelled !== isBClosedOrCancelled) {
        return isAClosedOrCancelled ? 1 : -1;
      }

      if (isAClosedOrCancelled && isBClosedOrCancelled) {
        if (a.status !== b.status) {
          return a.status === 'Closed' ? -1 : 1;
        }
      } else {
        const rankA = priorityRank[a.priority] || 5;
        const rankB = priorityRank[b.priority] || 5;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
      }

      const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (deadlineA !== deadlineB) {
        return deadlineA - deadlineB;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const sortedProjects = sortProjects(projects);

  const displayedCompanies = isDirectorOrDev
    ? companies
    : companies.filter(c => selectedCompanyId ? c.id === selectedCompanyId : true);

  const handleDeleteClick = (e: React.MouseEvent, project: ProjectItem) => {
    e.stopPropagation();
    if (user?.role_name === 'Project Manager') {
      alert('Project Manager is strictly prohibited from deleting projects.');
      return;
    }
    if (!['Developer', 'Director'].includes(user?.role_name || '')) {
      alert('Only Developer or Director can delete projects.');
      return;
    }
    setProjectToDelete(project);
  };

  return (
    <div className="min-h-screen bg-[#EBE5E5] flex flex-col">
      <GlobalNavbar />

      {/* Main content wrapper with consistent 5px horizontal padding (Requirement 5) */}
      <main className="flex-1 w-full px-[5px] py-4 space-y-5">
        {/* Main Workspace 75% Left / 25% Right Split */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
          {/* LEFT 75%: Statistics Row + Company Project Lists + Interactive Gantt */}
          <div className="lg:col-span-3 space-y-5">
            {/* Requirement 1: Dashboard Statistics Directly on Homepage Background */}
            {uiConfig.statistics?.visible !== false && (
              <div className="flex flex-wrap items-center justify-between gap-4 py-1 px-1">
                {/* Horizontal Statistics with Equal Spacing & Alignment */}
                <div className="flex items-center space-x-8 sm:space-x-14 flex-wrap gap-y-3">
                  {/* Total Projects */}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                      <EditableUI id="stat_label_total" defaultText={uiConfig.statistics?.card1Label || 'Total Projects'} />
                    </span>
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight mt-0.5">
                      {stats ? stats.total_projects : '...'}
                    </span>
                  </div>

                  {/* Completed */}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#2F614E]">
                      <EditableUI id="stat_label_completed" defaultText={uiConfig.statistics?.card2Label || 'Completed'} />
                    </span>
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#2F614E] tracking-tight mt-0.5">
                      {stats ? stats.completed_projects : '...'}
                    </span>
                  </div>

                  {/* Ongoing */}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                      <EditableUI id="stat_label_ongoing" defaultText={uiConfig.statistics?.card3Label || 'Ongoing'} />
                    </span>
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#2563EB] tracking-tight mt-0.5">
                      {stats ? stats.ongoing_projects : '...'}
                    </span>
                  </div>
                </div>

                {/* Far Right: Two-Option Toggle PROJECT | AMOUNT (Requirements 1 & 2) */}
                {canAccessAmountMode && (
                  <div className="flex items-center bg-[#DED7D7] p-1 rounded-[10px] border border-[#D5CECE] shadow-2xs self-center">
                    <button
                      type="button"
                      onClick={() => setDashboardMode('project')}
                      className={`px-3 py-1 rounded-[7px] text-xs font-bold transition-all ${
                        dashboardMode === 'project'
                          ? 'bg-[#FFFFFF] text-[#0A0A0A] shadow-xs'
                          : 'text-[#666666] hover:text-[#0A0A0A]'
                      }`}
                    >
                      PROJECT
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardMode('amount')}
                      className={`px-3 py-1 rounded-[7px] text-xs font-bold transition-all ${
                        dashboardMode === 'amount'
                          ? 'bg-[#FFFFFF] text-[#0A0A0A] shadow-xs'
                          : 'text-[#666666] hover:text-[#0A0A0A]'
                      }`}
                    >
                      AMOUNT
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* In Amount Mode: Portfolio Financial Summary Ribbon */}
            {dashboardMode === 'amount' && financeDashboard && (
              <div className="bg-[#FFFFFF] rounded-[14px] border border-[#E1DCDC] p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#0A0A0A]">
                  <Wallet className="w-4 h-4 text-[#43866B]" />
                  <span>Financial Collection Summary:</span>
                </div>

                <div className="flex flex-wrap items-center gap-6 sm:gap-10 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#888888] block">Total Quoted</span>
                    <span className="text-sm font-extrabold text-[#111827]">
                      {financeDashboard.summary.currency} {financeDashboard.summary.total_quoted_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#2F614E] block">Total Collected</span>
                    <span className="text-sm font-extrabold text-[#2F614E]">
                      {financeDashboard.summary.currency} {financeDashboard.summary.total_received_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#A93232] block">Total Outstanding</span>
                    <span className="text-sm font-extrabold text-[#A93232]">
                      {financeDashboard.summary.currency} {financeDashboard.summary.total_remaining_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#5269A8] block">Recovery Rate</span>
                    <span className="text-sm font-extrabold text-[#5269A8]">
                      {financeDashboard.summary.collection_percentage}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Company Project Lists */}
            {displayedCompanies.map(company => {
              const companyProjects = sortedProjects.filter(p => p.company_id === company.id);

              const cCompleted = companyProjects.filter(p => p.status === 'Closed').length;
              const cOngoing = companyProjects.filter(p => ['In Progress', 'Review', 'On Hold'].includes(p.status)).length;
              const cTotal = companyProjects.length;

              return (
                <div 
                  key={company.id}
                  className="bg-[#FFFFFF] rounded-[14px] border border-[#E1DCDC] shadow-xs overflow-hidden flex flex-col transition-all"
                >
                  {/* Company Header with Statistics */}
                  <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      {company.logo_url && (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="w-9 h-9 rounded-[4px] object-contain bg-white p-1 border border-[#E1DCDC] flex-shrink-0"
                        />
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-sm font-bold text-[#0A0A0A]">{company.name}</h2>
                          <span className="text-[10px] font-bold text-[#666666] bg-white px-1.5 py-0.5 rounded border border-[#E1DCDC]">
                            {company.code}
                          </span>
                        </div>
                        {company.description && (
                          <p className="text-[11px] text-[#888888] truncate max-w-md mt-0.5">
                            {company.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-semibold bg-white px-3 py-1.5 rounded-[8px] border border-[#E1DCDC] shadow-2xs flex-shrink-0 self-start sm:self-auto">
                      <span className="text-[#888888] text-[11px] font-bold uppercase tracking-wider mr-1">
                        Company Statistics:
                      </span>
                      <span className="text-[#333333]">
                        Total: <strong className="text-[#0A0A0A]">{cTotal}</strong>
                      </span>
                      <span className="text-[#E1DCDC]">|</span>
                      <span className="text-[#43866B]">
                        Completed: <strong className="text-[#43866B]">{cCompleted}</strong>
                      </span>
                      <span className="text-[#E1DCDC]">|</span>
                      <span className="text-[#5269A8]">
                        Ongoing: <strong className="text-[#5269A8]">{cOngoing}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Mode-Dependent Table */}
                  <div className="overflow-x-auto">
                    {dashboardMode === 'amount' ? (
                      /* AMOUNT MODE TABLE (Requirement 2.B) */
                      <table className="w-full table-fixed min-w-[880px] text-left text-xs">
                        <colgroup>
                          <col className="w-auto min-w-[200px]" />
                          <col className="w-[140px]" />
                          <col className="w-[140px]" />
                          <col className="w-[140px]" />
                          <col className="w-[130px]" />
                          <col className="w-[120px]" />
                        </colgroup>
                        <thead className="bg-[#F5F3F4]/70 border-b border-[#E1DCDC] text-[10px] uppercase font-bold text-[#888888]">
                          <tr>
                            <th className="py-3 px-4">Project Name</th>
                            <th className="py-3 px-3">Quoted Amount</th>
                            <th className="py-3 px-3">Amount Received</th>
                            <th className="py-3 px-3">Remaining Amount</th>
                            <th className="py-3 px-3">Collection Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F3F4]">
                          {companyProjects.map(item => {
                            const pf = financesByProject.get(item.id);
                            const curr = pf?.currency || '₹';
                            const quotedVal = pf?.quoted_amount || 0;
                            const receivedVal = pf?.total_received || 0;
                            const remainingVal = pf?.remaining_amount ?? Math.max(0, quotedVal - receivedVal);
                            const pStatus = pf?.status || 'Quoted';
                            const badge = PAYMENT_STATUS_CONFIG[pStatus] || { bg: '#F3F4F6', text: '#4B5563' };

                            return (
                              <tr
                                key={item.id}
                                className="hover:bg-[#F9F9F9] transition-colors"
                              >
                                {/* Project Name */}
                                <td className="py-3 px-4 font-semibold text-[#333333] truncate">
                                  <div 
                                    onClick={() => navigate(`/projects/${item.id}`)}
                                    className="truncate text-xs font-semibold text-[#0A0A0A] hover:underline cursor-pointer"
                                  >
                                    {item.title}
                                  </div>
                                  <div className="text-[10px] text-[#888888] truncate mt-0.5">
                                    {item.modules?.length || 0} modules • {pf?.payment_count || 0} payments recorded
                                  </div>
                                </td>

                                {/* Quoted Amount */}
                                <td className="py-3 px-3 align-middle font-bold text-[#111827] text-xs">
                                  {curr} {quotedVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>

                                {/* Amount Received */}
                                <td className="py-3 px-3 align-middle font-bold text-[#2F614E] text-xs">
                                  {curr} {receivedVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>

                                {/* Remaining Amount */}
                                <td className="py-3 px-3 align-middle font-bold text-[#A93232] text-xs">
                                  {curr} {remainingVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>

                                {/* Payment / Collection Status */}
                                <td className="py-3 px-3 align-middle">
                                  <span
                                    style={{ backgroundColor: badge.bg, color: badge.text }}
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block whitespace-nowrap"
                                  >
                                    {pStatus}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                                  <div className="flex items-center justify-end space-x-1.5" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveFinanceProject({ id: item.id, title: item.title });
                                        setIsFinanceModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-[8px] bg-[#0A0A0A] text-white hover:bg-[#333333] text-xs font-semibold flex items-center space-x-1 transition-colors shadow-2xs"
                                      title="Record payment or update finances"
                                    >
                                      <DollarSign className="w-3 h-3 text-[#43866B]" />
                                      <span>Manage</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => navigate(`/projects/${item.id}`)}
                                      className="p-1 rounded-[6px] text-[#888888] hover:text-[#0A0A0A] hover:bg-[#E8E4E4] transition-colors"
                                      title="Open Project Details"
                                    >
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {companyProjects.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-xs text-[#888888]">
                                No active projects in this company.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      /* PROJECT MODE TABLE (Requirement 2.A - Preserves existing layout) */
                      <table className="w-full table-fixed min-w-[880px] text-left text-xs">
                        <colgroup>
                          <col className="w-auto min-w-[220px]" />
                          <col className="w-[115px]" />
                          <col className="w-[100px]" />
                          <col className="w-[130px]" />
                          <col className="w-[125px]" />
                          <col className="w-[110px]" />
                          <col className="w-[95px]" />
                        </colgroup>
                        <thead className="bg-[#F5F3F4]/70 border-b border-[#E1DCDC] text-[10px] uppercase font-bold text-[#888888]">
                          <tr>
                            <th className="py-3 px-4">
                              <EditableUI id="th_name" defaultText="Name" />
                            </th>
                            <th className="py-3 px-3">
                              <EditableUI id="th_status" defaultText="Status" />
                            </th>
                            <th className="py-3 px-3">
                              <EditableUI id="th_priority" defaultText="Priority" />
                            </th>
                            <th className="py-3 px-3">
                              <EditableUI id="th_progress" defaultText="Progress" />
                            </th>
                            <th className="py-3 px-3">
                              <EditableUI id="th_deadline" defaultText="Deadline" />
                            </th>
                            <th className="py-3 px-3">
                              <EditableUI id="th_last_updated" defaultText="Last Updated" />
                            </th>
                            <th className="py-3 px-4 text-right">
                              <EditableUI id="th_actions" defaultText="Actions" />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F3F4]">
                          {companyProjects.map(item => {
                            const statusColor = STATUS_CONFIG[item.status] || STATUS_CONFIG['In Progress'];
                            const priorityColor = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG['Medium'];

                            return (
                              <tr
                                key={item.id}
                                onClick={() => navigate(`/projects/${item.id}`)}
                                className="hover:bg-[#F9F9F9] cursor-pointer transition-colors"
                              >
                                {/* Name & Module Count */}
                                <td className="py-3 px-4 font-semibold text-[#333333] truncate">
                                  <div className="truncate text-xs font-semibold text-[#0A0A0A]">
                                    {item.title}
                                  </div>
                                  <div className="text-[10px] text-[#888888] truncate mt-0.5">
                                    {item.modules?.length || 0} modules linked
                                  </div>
                                </td>

                                {/* Status Badge */}
                                <td className="py-3 px-3 align-middle">
                                  <span
                                    style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold inline-block whitespace-nowrap"
                                  >
                                    {item.status}
                                  </span>
                                </td>

                                {/* Priority Badge */}
                                <td className="py-3 px-3 align-middle">
                                  <span
                                    style={{ backgroundColor: priorityColor.bg, color: priorityColor.text }}
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold inline-block whitespace-nowrap"
                                  >
                                    {item.priority}
                                  </span>
                                </td>

                                {/* Progress */}
                                <td className="py-3 px-3 align-middle">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-16 h-1.5 bg-[#E8E4E4] rounded-full overflow-hidden flex-shrink-0">
                                      <div
                                        style={{ width: `${item.progress}%` }}
                                        className="h-full bg-[#333333] rounded-full"
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#333333] w-8">
                                      {item.progress}%
                                    </span>
                                  </div>
                                </td>

                                {/* Deadline */}
                                <td className="py-3 px-3 text-[#666666] whitespace-nowrap text-[11px] align-middle">
                                  {item.deadline
                                    ? new Date(item.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                                    : 'No deadline'}
                                </td>

                                {/* Last Updated */}
                                <td className="py-3 px-3 text-[#888888] whitespace-nowrap text-[10px] align-middle">
                                  {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </td>

                                {/* Actions */}
                                <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                                  <div className="flex items-center justify-end space-x-1.5" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => navigate(`/projects/${item.id}`)}
                                      className="px-2.5 py-1 rounded-[8px] bg-[#F5F3F4] hover:bg-[#E8E4E4] text-[#333333] text-xs font-semibold flex items-center space-x-1 transition-colors"
                                    >
                                      <span>View</span>
                                      <ArrowUpRight className="w-3 h-3" />
                                    </button>

                                    {['Developer', 'Director'].includes(user?.role_name || '') && (
                                      <button
                                        onClick={e => handleDeleteClick(e, item)}
                                        className="p-1 rounded-[6px] text-[#888888] hover:text-[#A93232] hover:bg-[#F5DEDE]/50 transition-colors"
                                        title="Delete project"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {companyProjects.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-xs text-[#888888]">
                                No active projects in this company.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT 25%: Sticky Notes Panel */}
          <div className="lg:col-span-1">
            <StickyNotesPanel />
          </div>
        </section>

        {/* SECTION 7: Full-Width Gantt Chart */}
        <section className="w-full">
          <InteractiveGantt companyId={isDirectorOrDev ? undefined : (selectedCompanyId || undefined)} />
        </section>
      </main>

      {/* Project Financial Tracking & Payment Ledger Modal */}
      {activeFinanceProject && (
        <ProjectFinanceModal
          isOpen={isFinanceModalOpen}
          onClose={() => {
            setIsFinanceModalOpen(false);
            setActiveFinanceProject(null);
          }}
          projectId={activeFinanceProject.id}
          projectTitle={activeFinanceProject.title}
          onUpdated={() => {
            loadFinanceData();
          }}
        />
      )}

      {/* GitHub-Style Project Deletion Confirmation Modal */}
      {projectToDelete && (
        <ProjectDeleteModal
          isOpen={true}
          onClose={() => setProjectToDelete(null)}
          project={projectToDelete}
          onDeleted={loadDashboardData}
        />
      )}

      <BackToTop />
      <DeveloperUIEditorModal />
    </div>
  );
};
