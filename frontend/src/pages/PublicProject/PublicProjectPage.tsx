import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../config/theme';

export const PublicProjectPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.getPublicProject(token)
      .then(res => {
        setData(res);
      })
      .catch(err => {
        setError(err.message || 'Public link is invalid or has been revoked');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EBE5E5] flex items-center justify-center p-4">
        <p className="text-xs text-[#888888]">Loading authorized project view...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#EBE5E5] flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-[#E1DCDC] shadow-lg max-w-md w-full space-y-3">
          <AlertCircle className="w-8 h-8 text-[#B65F65] mx-auto" />
          <h2 className="text-base font-bold text-[#333333]">Access Denied or Link Revoked</h2>
          <p className="text-xs text-[#666666] leading-relaxed">
            {error || 'This project share link has either expired or been revoked by the Director.'}
          </p>
        </div>
      </div>
    );
  }

  const { project, modules } = data;
  const statusColor = (STATUS_CONFIG as Record<string, any>)[project.status] || STATUS_CONFIG['In Progress'];
  const priorityColor = (PRIORITY_CONFIG as Record<string, any>)[project.priority] || PRIORITY_CONFIG['Medium'];

  return (
    <div className="min-h-screen bg-[#EBE5E5] flex flex-col">
      {/* Public Header */}
      <header className="bg-[#FFFFFF] border-b border-[#E1DCDC] px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <img
            src="/logos/1.png"
            alt="AVD Group"
            className="h-8 w-auto object-contain"
          />
          <span className="text-xs font-bold text-[#333333] hidden sm:inline">
            Public Stakeholder View
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-[#43866B] bg-[#D9EEE5] px-3 py-1 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verified Share Token</span>
        </div>
      </header>

      {/* Main Public Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Project Header Banner */}
        <section className="bg-[#FFFFFF] rounded-2xl p-6 border border-[#E1DCDC] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#888888] tracking-wider">
                {project.company_name}
              </span>
              <h1 className="text-xl font-bold text-[#0A0A0A] mt-0.5">{project.title}</h1>
            </div>

            <div className="flex items-center space-x-2">
              <span
                style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                className="px-3 py-1 rounded-full text-xs font-semibold"
              >
                {project.status}
              </span>
              <span
                style={{ backgroundColor: priorityColor.bg, color: priorityColor.text }}
                className="px-3 py-1 rounded-full text-xs font-semibold"
              >
                {project.priority}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#555555] leading-relaxed">
            {project.description || 'Public project delivery summary.'}
          </p>

          <div className="pt-2 border-t border-[#E1DCDC] grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[10px] text-[#888888] block">Overall Completion</span>
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-24 h-2 bg-[#E8E4E4] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${project.progress}%` }}
                    className="h-full bg-[#43866B] rounded-full"
                  />
                </div>
                <strong className="text-xs text-[#43866B]">{project.progress}%</strong>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#888888] block">Commenced</span>
              <span className="font-semibold text-[#333333]">
                {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#888888] block">Target Delivery</span>
              <span className="font-semibold text-[#333333]">
                {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </section>

        {/* Modules / Deliverables Overview */}
        <section className="bg-[#FFFFFF] rounded-2xl border border-[#E1DCDC] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4]">
            <h3 className="text-sm font-bold text-[#333333]">
              Project Work Streams & Milestones ({modules.length})
            </h3>
          </div>

          <div className="divide-y divide-[#F5F3F4]">
            {modules.map((m: any) => {
              const modStatusColor = (STATUS_CONFIG as Record<string, any>)[m.status] || STATUS_CONFIG['In Progress'];
              return (
                <div key={m.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-[#333333]">{m.name}</span>
                      <span
                        style={{ backgroundColor: modStatusColor.bg, color: modStatusColor.text }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      >
                        {m.status}
                      </span>
                    </div>
                    {m.description && (
                      <p className="text-xs text-[#666666] leading-relaxed">{m.description}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-xs sm:text-right">
                    <div>
                      <span className="text-[10px] text-[#888888] block">Progress</span>
                      <span className="font-semibold text-[#43866B]">{m.progress}%</span>
                    </div>
                    {m.deadline && (
                      <div>
                        <span className="text-[10px] text-[#888888] block">Deadline</span>
                        <span className="text-[#333333]">{new Date(m.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Public Footer */}
        <footer className="text-center text-[11px] text-[#888888] py-4">
          © {new Date().getFullYear()} AVD Group. Real-time stakeholder transparency. Read-only view.
        </footer>
      </main>
    </div>
  );
};
