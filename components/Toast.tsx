import React, { useEffect } from 'react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:right-auto z-[60] flex flex-col gap-3 pointer-events-none items-center">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const styles = {
    success: 'bg-green-600/90 border-green-500 shadow-green-500/20',
    error: 'bg-red-600/90 border-red-500 shadow-red-500/20',
    info: 'bg-blue-600/90 border-blue-500 shadow-blue-500/20',
  };

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  return (
    <div className={`${styles[toast.type]} backdrop-blur-md text-white px-5 py-3 rounded-full shadow-lg border flex items-center gap-3 min-w-[320px] max-w-md animate-fade-in-up pointer-events-auto transition-all transform hover:scale-[1.02]`}>
      <i className={`fa-solid ${icons[toast.type]} text-lg`}></i>
      <span className="text-sm font-medium flex-1 tracking-wide">{toast.text}</span>
      <button onClick={() => onRemove(toast.id)} className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
        <i className="fa-solid fa-xmark text-xs"></i>
      </button>
    </div>
  );
};

export default Toast;