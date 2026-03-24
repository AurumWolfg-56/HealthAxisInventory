
import React from 'react';
import { User, UserRole } from '../types';
import { Language } from '../utils/translations';
import { supabase } from '../src/lib/supabase';
import { DailyReportService } from '../services/DailyReportService';

interface SettingsProps {
    user: User;
    onUpdateUser: (user: User) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    onResetData: () => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const Settings: React.FC<SettingsProps> = ({ user, onUpdateUser, isDarkMode, toggleTheme, onResetData, language, setLanguage, t }) => {
    const handleReset = () => {
        if (window.confirm("Are you sure?")) {
            onResetData();
        }
    };

    const ROLES = [UserRole.OWNER, UserRole.MANAGER, UserRole.DOCTOR, UserRole.MA, UserRole.FRONT_DESK];

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-fade-in-up">
            <header className="mb-8">
                <h2 className="text-display text-slate-900 dark:text-white">{t('set_title')}</h2>
                <p className="text-caption mt-1">{t('set_subtitle')}</p>
            </header>

            {/* Profile Section */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                    <div className="w-12 h-12 rounded-2xl bg-medical-50 dark:bg-medical-900/20 flex items-center justify-center text-medical-600 dark:text-medical-400">
                        <i className="fa-solid fa-id-card text-xl"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('sec_profile')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('lbl_display_name')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={user.username || ''} // Ensure not undefined
                                onChange={(e) => onUpdateUser({ ...user, username: e.target.value })}
                                className="flex-1 h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-bold text-sm"
                                placeholder="Enter username"
                            />
                            <button
                                onClick={async () => {
                                    if (!user.username) return alert('Username cannot be empty');
                                    try {
                                        const { error } = await supabase.from('profiles').update({ username: user.username }).eq('id', user.id);
                                        if (error) throw error;
                                        alert('Profile updated successfully!');
                                    } catch (e: any) {
                                        alert('Error saving profile: ' + e.message);
                                    }
                                }}
                                className="px-6 h-11 bg-medical-600 text-white rounded-xl font-semibold hover:bg-medical-700 transition-all shadow-lg shadow-medical-500/30 text-sm"
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('lbl_role')}</label>
                        <div className="flex flex-wrap gap-2">
                            {ROLES.map((role) => (
                                <div
                                    key={role}
                                    className={`px-4 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border-2 cursor-not-allowed opacity-70
                              ${user.role === role
                                            ? 'bg-medical-600 border-medical-600 text-white shadow-lg shadow-medical-500/30'
                                            : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500'
                                        }`}
                                    title="Role cannot be changed here"
                                >
                                    {role.replace('_', ' ')}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">* Roles are managed by Administrators</p>
                    </div>
                </div>
            </section>

            {/* Preferences */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                    <div className="w-12 h-12 rounded-2xl bg-medical-50 dark:bg-medical-900/20 flex items-center justify-center text-medical-600 dark:text-medical-400">
                        <i className="fa-solid fa-sliders text-xl"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('sec_prefs')}</h3>
                </div>

                <div className="space-y-6">
                    {/* Theme Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer gap-4" onClick={toggleTheme}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-yellow-100 text-orange-500'}`}>
                                <i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'}`}></i>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{t('lbl_appearance')}</p>
                                <p className="text-sm text-slate-500">{t('desc_appearance')}</p>
                            </div>
                        </div>
                        <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex-shrink-0 self-start sm:self-auto ${isDarkMode ? 'bg-medical-600' : 'bg-slate-300'}`}>
                            <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>

                    {/* Language Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-medical-100 dark:bg-medical-900/30 flex items-center justify-center text-medical-600 dark:text-medical-400 text-xl flex-shrink-0">
                                <i className="fa-solid fa-language"></i>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{t('lbl_language')}</p>
                                <p className="text-sm text-slate-500">{t('desc_language')}</p>
                            </div>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${language === 'en' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            >
                                🇺🇸 EN
                            </button>
                            <button
                                onClick={() => setLanguage('es')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${language === 'es' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            >
                                🇪🇸 ES
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-4"></div>

                    {/* Data Recovery */}
                    <div className="p-4 bg-medical-50 dark:bg-medical-900/10 rounded-xl border border-medical-100 dark:border-medical-900/20 mb-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-medical-100 dark:bg-medical-900/30 flex items-center justify-center text-medical-600 dark:text-medical-400">
                                    <i className="fa-solid fa-cloud-arrow-up"></i>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">Recover Local Reports</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Upload legacy reports from this device to the database.</p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (window.confirm("Upload legacy local reports to the database? This will skip reports that already exist.")) {
                                        const count = await DailyReportService.restoreLocalReports();
                                        alert(`Recovery complete. ${count} reports uploaded.`);
                                    }
                                }}
                                className="px-6 py-2.5 bg-white dark:bg-slate-800 text-medical-600 dark:text-medical-400 rounded-xl text-sm font-bold hover:shadow-lg hover:text-medical-700 transition-all whitespace-nowrap"
                            >
                                <i className="fa-solid fa-upload mr-2"></i> Recover
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{t('lbl_reset')}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">{t('desc_reset')}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleReset}
                                className="px-6 py-2.5 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold hover:shadow-lg hover:text-red-700 transition-all whitespace-nowrap"
                            >
                                {t('btn_reset')}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <div className="text-center pt-8">
                <p className="text-slate-400 text-sm font-medium">{t('footer_version')}</p>
            </div>
        </div>
    );
};

export default Settings;
