import React, { useState, useEffect, useRef } from 'react';
import { InventoryItem, ActivityLog, Permission, AppRoute, User, UserRole } from '../types';
import { InventoryReportDocument } from './InventoryReportDocument';

interface ReportsProps {
  inventory: InventoryItem[];
  logs: ActivityLog[];
  user: User;
  t: (key: string) => string;
  hasPermission?: (permission: Permission) => boolean;
  onNavigate?: (route: AppRoute) => void;
  onUpdateLog?: (id: string, details: string) => void;
  onDeleteLog?: (id: string) => void;
  initialTab?: string; // Deep linking support
}

const Reports: React.FC<ReportsProps> = ({ inventory, logs, user, t, hasPermission, onNavigate, onUpdateLog, onDeleteLog, initialTab }) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'history' | 'expiring'>('alerts');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogDetails, setEditLogDetails] = useState<string>('');

  // PDF Report States
  const [isExporting, setIsExporting] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Handle deep link prop
  useEffect(() => {
    if (initialTab && (initialTab === 'alerts' || initialTab === 'history' || initialTab === 'expiring')) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Logic: Low Stock
  const lowStockItems = inventory.filter(item => item.stock <= item.minStock);

  // Logic: Expiring Soon (30 Days)
  const expiringItems = inventory.filter(item => {
    if (!item.expiryDate) return false;
    const today = new Date();
    const expDate = new Date(item.expiryDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= -1; // Include expired yesterday just in case
  }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const getActionColor = (action: string) => {
    switch (action) {
      case 'ADDED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'REMOVED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'UPDATED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'CONSUMED': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'RESTOCKED': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'AUDITED': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'DAILY_CLOSE': return 'bg-gray-900 text-white dark:bg-white dark:text-gray-900';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    const exp = new Date(dateStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filtered Logs for History and Export
  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp).toISOString().split('T')[0];
    return logDate >= startDate && logDate <= endDate;
  });

  const generatePDF = () => {
    if (!reportRef.current || !(window as any).html2pdf) {
      alert("PDF generator not ready. Please wait.");
      return;
    }

    setIsExporting(true);

    // Give time for the hidden component to mount/render if it was conditional
    setTimeout(() => {
      const opt = {
        margin: 0,
        filename: `InventoryReport_${startDate}_to_${endDate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };

      (window as any).html2pdf()
        .set(opt)
        .from(reportRef.current)
        .save()
        .then(() => {
          setIsExporting(false);
        });
    }, 100);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-10 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
            <i className="fa-solid fa-chart-column text-xl text-white"></i>
          </div>
          <div>
            <h2 className="text-display text-slate-900 dark:text-white">{t('rep_title')}</h2>
            <p className="text-caption mt-0.5">{t('rep_subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(user.role === UserRole.OWNER || user.role === UserRole.MANAGER) && (
            <button
              onClick={generatePDF}
              disabled={isExporting}
              className="h-12 px-6 bg-medical-600 hover:bg-medical-500 text-white rounded-2xl font-bold shadow-xl shadow-medical-500/30 transition-all flex items-center gap-2 disabled:opacity-50 hover:scale-105 active:scale-95"
            >
              {isExporting ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  Generating...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-file-pdf"></i>
                  Export PDF
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="glass-panel p-1.5 rounded-2xl flex w-full md:w-fit overflow-x-auto shadow-sm">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'alerts'
            ? 'bg-white dark:bg-slate-800 shadow-sm text-red-500'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <i className="fa-solid fa-triangle-exclamation mr-2"></i> {t('tab_alerts')}
          {lowStockItems.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-bold">{lowStockItems.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('expiring')}
          className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'expiring'
            ? 'bg-white dark:bg-slate-800 shadow-sm text-orange-500'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <i className="fa-solid fa-hourglass-end mr-2"></i> Expiring Soon
          {expiringItems.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-bold">{expiringItems.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'history'
            ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-500'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <i className="fa-solid fa-clock-rotate-left mr-2"></i> {t('tab_history')}
        </button>
      </div>

      {/* Report Controls (Date Picker) */}
      <div className="glass-panel p-4 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-4 luxury-shadow">
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl flex-1">
          <i className="fa-solid fa-calendar text-slate-400"></i>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">From Date</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent w-full text-sm font-bold text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl flex-1">
          <i className="fa-solid fa-calendar-check text-slate-400"></i>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">To Date</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent w-full text-sm font-bold text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>
        <div className="hidden md:block w-px h-10 bg-slate-200 dark:bg-slate-700 mx-2"></div>
        <div className="text-sm text-slate-500 px-4">
          Showing <span className="font-bold text-slate-900 dark:text-white">{filteredLogs.length}</span> actions
        </div>
      </div>

      {/* Content Area */}
      <div className="glass-panel rounded-[2rem] luxury-shadow overflow-hidden">

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="overflow-x-auto">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
                  <i className="fa-solid fa-check text-3xl text-emerald-500"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('msg_no_alerts')}</h3>
                <p className="text-gray-500 mt-2">Inventory levels are healthy.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('col_item')}</th>
                    <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('col_status')}</th>
                    <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('th_location')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {lowStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-6">
                        <div className="font-bold text-gray-900 dark:text-white text-lg">{item.name}</div>
                        <div className="text-xs text-gray-400 mt-1 font-mono">{t('lbl_batch')}: {item.batchNumber}</div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 max-w-[200px]">
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-red-500">{item.stock} {t('lbl_units')}</span>
                              <span className="text-gray-400">{t('lbl_min')}: {item.minStock}</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full animate-pulse" style={{ width: `${Math.min(100, (item.stock / item.minStock) * 100)}%` }}></div>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs font-bold whitespace-nowrap">
                            {t('msg_alert_low')}
                          </span>
                        </div>
                      </td>
                      <td className="p-6 text-sm font-bold text-gray-600 dark:text-gray-300">
                        <i className="fa-solid fa-location-dot text-gray-400 mr-2"></i>
                        {item.location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* EXPIRING TAB */}
        {activeTab === 'expiring' && (
          <div className="overflow-x-auto">
            {expiringItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
                  <i className="fa-solid fa-calendar-check text-3xl text-emerald-500"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Upcoming Expirations</h3>
                <p className="text-gray-500 mt-2">Nothing expires within the next 30 days.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('col_item')}</th>
                    <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">Expiration Date</th>
                    <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">Days Remaining</th>
                    <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('th_stock')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {expiringItems.map((item) => {
                    const daysLeft = getDaysRemaining(item.expiryDate);
                    const urgencyClass = daysLeft <= 7 ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50';

                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-6">
                          <div className="font-bold text-gray-900 dark:text-white text-lg">{item.name}</div>
                          <div className="text-xs text-gray-400 mt-1 font-mono">{t('lbl_batch')}: {item.batchNumber}</div>
                        </td>
                        <td className="p-6">
                          <div className="font-mono font-bold text-gray-700 dark:text-gray-300">
                            {new Date(item.expiryDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-6">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg font-bold text-sm ${urgencyClass} dark:bg-opacity-20`}>
                            <i className="fa-solid fa-clock"></i>
                            {daysLeft <= 0 ? 'EXPIRED' : `${daysLeft} days`}
                          </span>
                        </td>
                        <td className="p-6">
                          <span className="font-black text-lg">{item.stock}</span> <span className="text-xs text-gray-400">{t(item.unit)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('col_action')}</th>
                  <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">Details</th>
                  <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('col_user')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-gray-500 italic">No activity for the selected dates.</td>
                  </tr>
                ) : filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group/row">
                    <td className="p-6">
                      <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold mb-1 ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <div className="text-xs text-gray-400 font-mono">
                        {log.timestamp.toLocaleDateString()} {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-6 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {editingLogId === log.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editLogDetails}
                            onChange={(e) => setEditLogDetails(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-500 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateLog?.(log.id, editLogDetails);
                                setEditingLogId(null);
                              } else if (e.key === 'Escape') {
                                setEditingLogId(null);
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              onUpdateLog?.(log.id, editLogDetails);
                              setEditingLogId(null);
                            }}
                            className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-sm"
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button
                            onClick={() => setEditingLogId(null)}
                            className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 shadow-sm"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group/detail min-h-[1.5rem]">
                          <span>{log.details}</span>
                          {(user.role === UserRole.OWNER || user.role === UserRole.MANAGER) && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-all">
                              <button
                                onClick={() => {
                                  setEditingLogId(log.id);
                                  setEditLogDetails(log.details);
                                }}
                                className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                                title="Edit Log Entry"
                              >
                                <i className="fa-solid fa-pen-to-square text-xs"></i>
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this log entry?')) {
                                    onDeleteLog?.(log.id);
                                  }
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                title="Delete Log Entry"
                              >
                                <i className="fa-solid fa-trash-can text-xs"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-6 text-sm font-bold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">
                          {log.user.charAt(0).toUpperCase()}
                        </div>
                        {log.user}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- HIDDEN REPORT ENGINE FOR PDF CAPTURE --- */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
        <div ref={reportRef}>
          <InventoryReportDocument
            data={{
              inventory,
              logs: filteredLogs,
              startDate: new Date(startDate).toLocaleDateString(),
              endDate: new Date(endDate).toLocaleDateString(),
              author: user.username,
              facilityName: 'HealthAxis Medical Group'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Reports;
