'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';

export default function GasConfigPage() {
    const supabase = createClient();
    const [users, setUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingMap, setLoadingMap] = useState<{[key: string]: boolean}>({});
    const [initialFetch, setInitialFetch] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            const { data } = await supabase.from('profiles').select('id, first_name, last_name, email').order('created_at', { ascending: false });
            const { data: wallets } = await supabase.from('wallets').select('user_id, readable_id, gas_override');
            
            if (data && wallets) {
                const combined = data.map((u: any) => {
                    const w = wallets.find((w: any) => w.user_id === u.id);
                    return { ...u, readable_id: w?.readable_id, gas_override: w?.gas_override || false };
                });
                setUsers(combined);
            }
            setInitialFetch(false);
        };
        fetchUsers();
    }, []);

    const handleToggle = async (userId: string, currentOverride: boolean, userName: string) => {
        setLoadingMap(prev => ({ ...prev, [userId]: true }));
        const newValue = !currentOverride;
        
        const { error } = await supabase.from('wallets').update({ gas_override: newValue }).eq('user_id', userId);
        
        if (error) {
            toast.error('Failed to update gas config');
        } else {
            toast.success(`Gas fees ${newValue ? 'Standard (Pennies)' : 'Locked (3.0 ETH)'} for ${userName || 'User'}`);
            // Update local state
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, gas_override: newValue } : u));
        }
        setLoadingMap(prev => ({ ...prev, [userId]: false }));
    };

    const filteredUsers = users.filter(u => {
        const s = searchTerm.toLowerCase();
        const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const uid = (u.readable_id || u.id || '').toLowerCase();
        return name.includes(s) || email.includes(s) || uid.includes(s);
    });

    return (
        <div className="animate-in fade-in duration-300">
            <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden mb-8">
                <div className="bg-[#3498db] text-white px-4 py-3 border-b-4 border-black">
                    <h3 className="font-bold tracking-widest text-sm uppercase">Network Gas Fees Control</h3>
                </div>
                
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-2">
                    <p className="text-gray-600 text-sm">Manage the artificial gas fee lock for specific users. When standard fees are turned ON, the user experiences normal real-world gas fees (pennies). When OFF, the system triggers the 3.0 ETH lock.</p>
                    <input
                        type="text"
                        placeholder="Search by name, email, or Account ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-md border border-gray-300 p-2 rounded text-sm outline-none focus:border-[#3498db]"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#EAEAEA] border-b border-gray-300 text-xs uppercase tracking-widest text-gray-700">
                                <th className="p-3 border-r border-white font-bold w-[35%]">User</th>
                                <th className="p-3 border-r border-white font-bold w-[25%]">Account ID</th>
                                <th className="p-3 border-r border-white font-bold w-[20%] text-center">Status</th>
                                <th className="p-3 font-bold w-[20%] text-center">Toggle Standard Fees</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialFetch ? (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-gray-500 text-sm">Loading users...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-gray-500 text-sm">No users found.</td>
                                </tr>
                            ) : (
                                filteredUsers.map(u => (
                                    <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="p-3 text-sm border-r border-gray-100">
                                            <div className="font-bold text-gray-800">{u.first_name} {u.last_name}</div>
                                            <div className="text-gray-500 text-xs">{u.email}</div>
                                        </td>
                                        <td className="p-3 text-sm border-r border-gray-100 font-mono text-gray-600">
                                            {u.readable_id || 'N/A'}
                                        </td>
                                        <td className="p-3 text-sm border-r border-gray-100 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${u.gas_override ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {u.gas_override ? 'PENNIES (ON)' : '3.0 ETH LOCK (OFF)'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-center">
                                            <button 
                                                onClick={() => handleToggle(u.id, u.gas_override, u.first_name)}
                                                disabled={loadingMap[u.id]}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${u.gas_override ? 'bg-green-500' : 'bg-gray-300'} ${loadingMap[u.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${u.gas_override ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
