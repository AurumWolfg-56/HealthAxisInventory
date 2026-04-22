import React, { useState, useEffect } from 'react';
import { DictationProtocol, InventoryItem, ProtocolBundleItem, User } from '../types';
import { DictationProtocolService } from '../services/DictationProtocolService';

interface DictationProtocolsProps {
    inventory: InventoryItem[];
    user: User;
    t: (key: string) => string;
}

const DictationProtocols: React.FC<DictationProtocolsProps> = ({ inventory, user, t }) => {
    const [protocols, setProtocols] = useState<DictationProtocol[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProtocol, setSelectedProtocol] = useState<DictationProtocol | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<DictationProtocol>>({
        name: '',
        keywords: [],
        items: []
    });

    useEffect(() => {
        loadProtocols();
    }, []);

    const loadProtocols = async () => {
        setIsLoading(true);
        try {
            const data = await DictationProtocolService.fetchAll();
            setProtocols(data);
        } catch (error) {
            console.error('Failed to load protocols', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = () => {
        setSelectedProtocol(null);
        setEditForm({ name: '', keywords: [], items: [] });
        setIsEditing(true);
    };

    const handleEdit = (protocol: DictationProtocol) => {
        setSelectedProtocol(protocol);
        setEditForm({
            name: protocol.name,
            keywords: protocol.keywords || [],
            items: protocol.items || []
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        try {
            if (!editForm.name) return alert('Name is required');

            if (selectedProtocol) {
                await DictationProtocolService.updateProtocol(selectedProtocol.id, editForm);
            } else {
                if (!user.id) throw new Error('User not authenticated');
                await DictationProtocolService.createProtocol(editForm as Omit<DictationProtocol, 'id'>, user.id);
            }
            await loadProtocols();
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save protocol', error);
            alert('Failed to save protocol');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this protocol?')) return;
        try {
            await DictationProtocolService.deleteProtocol(id);
            await loadProtocols();
        } catch (error) {
            console.error('Failed to delete protocol', error);
        }
    };

    const addItemToBundle = (inventoryItemId: string) => {
        const item = inventory.find(i => i.id === inventoryItemId);
        if (!item) return;

        setEditForm(prev => ({
            ...prev,
            items: [
                ...(prev.items || []),
                { inventoryItemId, quantity: 1 }
            ]
        }));
    };

    const updateBundleItemQuantity = (index: number, quantity: number) => {
        setEditForm(prev => {
            const items = [...(prev.items || [])];
            items[index].quantity = quantity;
            return { ...prev, items };
        });
    };

    const removeBundleItem = (index: number) => {
        setEditForm(prev => {
            const items = [...(prev.items || [])];
            items.splice(index, 1);
            return { ...prev, items };
        });
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in-up">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-display text-slate-900 dark:text-white">Dictation Protocols</h2>
                    <p className="text-caption mt-1">Configure clinical procedures and their associated inventory deductions.</p>
                </div>
                {!isEditing && (
                    <button
                        onClick={handleCreateNew}
                        className="h-11 px-6 bg-medical-600 text-white rounded-xl font-semibold text-sm shadow-xl shadow-medical-500/30 flex items-center gap-2 transition-all transform hover:scale-105 hover:shadow-2xl active:scale-95 group"
                    >
                        <i className="fa-solid fa-plus text-base group-hover:rotate-90 transition-transform"></i>
                        <span className="tracking-tight">New Protocol</span>
                    </button>
                )}
            </header>

            {isEditing ? (
                <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/50 dark:border-slate-800 shadow-xl max-w-4xl">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-medical-100 dark:bg-medical-900/30 text-medical-600 flex items-center justify-center">
                                <i className="fa-solid fa-stethoscope"></i>
                            </div>
                            {selectedProtocol ? 'Edit Protocol' : 'Create Protocol'}
                        </h3>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center transition-all"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Protocol Name</label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="e.g. Suture, Upper Respiratory Infection, EKG"
                                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-4 ring-medical-500/20 focus:border-medical-500 outline-none transition-all font-medium text-slate-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Associated Inventory Items to Deduct</label>
                            <div className="space-y-3 mb-4">
                                {editForm.items?.map((item, index) => {
                                    const invItem = inventory.find(i => i.id === item.inventoryItemId);
                                    return (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="flex-1 font-bold text-slate-800 dark:text-slate-200">
                                                {invItem ? invItem.name : 'Unknown Item'}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-400 uppercase">Qty:</span>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    min="1"
                                                    onChange={e => updateBundleItemQuantity(index, parseFloat(e.target.value) || 1)}
                                                    className="w-20 h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center font-bold text-medical-600 focus:ring-2 ring-medical-500/20 outline-none"
                                                />
                                            </div>
                                            <button
                                                onClick={() => removeBundleItem(index)}
                                                className="w-10 h-10 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="relative">
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            addItemToBundle(e.target.value);
                                            e.target.value = ''; // Reset select
                                        }
                                    }}
                                    className="w-full h-12 px-4 appearance-none rounded-xl bg-medical-50 dark:bg-medical-900/10 border border-medical-200 dark:border-medical-800 text-medical-700 dark:text-medical-300 font-bold focus:ring-4 ring-medical-500/20 outline-none transition-all cursor-pointer"
                                >
                                    <option value="">+ Add Item to Protocol Bundle...</option>
                                    {inventory.filter(i => !editForm.items?.some(ei => ei.inventoryItemId === i.id)).sort((a,b) => a.name.localeCompare(b.name)).map(item => (
                                        <option key={item.id} value={item.id}>{item.name} ({item.stock} in stock)</option>
                                    ))}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-medical-500 pointer-events-none"></i>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="h-12 px-6 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="h-12 px-8 rounded-xl font-bold text-white bg-gradient-to-r from-medical-600 to-medical-500 shadow-xl shadow-medical-500/30 hover:scale-105 transition-all"
                            >
                                Save Protocol
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        <div className="col-span-full py-12 flex justify-center items-center">
                            <div className="animate-spin text-medical-500 text-3xl"><i className="fa-solid fa-circle-notch"></i></div>
                        </div>
                    ) : protocols.length === 0 ? (
                        <div className="col-span-full glass-panel p-12 rounded-3xl text-center border border-white/50 dark:border-slate-800 flex flex-col items-center justify-center opacity-70">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-3xl text-slate-400">
                                <i className="fa-solid fa-clipboard-list"></i>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No Protocols Defined</h3>
                            <p className="text-slate-500 max-w-sm">Create clinical dictation protocols to automatically suggest inventory deductions when procedures are performed.</p>
                        </div>
                    ) : (
                        protocols.map((protocol, i) => (
                            <div
                                key={protocol.id}
                                className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-slate-800 shadow-lg hover:shadow-xl hover:border-medical-500/30 transition-all group flex flex-col"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                                        {protocol.name}
                                    </h3>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(protocol)}
                                            className="w-8 h-8 rounded-lg bg-medical-50 dark:bg-medical-900/20 text-medical-600 flex items-center justify-center hover:bg-medical-500 hover:text-white transition-all"
                                        >
                                            <i className="fa-solid fa-pen text-xs"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(protocol.id)}
                                            className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                                        >
                                            <i className="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bundle Items ({protocol.items?.length || 0})</div>
                                    <div className="space-y-2">
                                        {protocol.items?.slice(0, 4).map((item, idx) => {
                                            const invItem = inventory.find(inv => inv.id === item.inventoryItemId);
                                            return (
                                                <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">{invItem?.name || 'Unknown'}</span>
                                                    <span className="font-bold text-medical-600 bg-medical-50 dark:bg-medical-900/30 px-2 py-0.5 rounded flex-shrink-0">x{item.quantity}</span>
                                                </div>
                                            );
                                        })}
                                        {(protocol.items?.length || 0) > 4 && (
                                            <div className="text-xs font-bold text-slate-500 text-center pt-2">
                                                + {(protocol.items?.length || 0) - 4} more items
                                            </div>
                                        )}
                                        {(!protocol.items || protocol.items.length === 0) && (
                                            <div className="text-sm italic text-slate-400">No items configured</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default DictationProtocols;
