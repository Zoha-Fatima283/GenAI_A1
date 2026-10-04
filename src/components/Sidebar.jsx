import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wand2, GitBranch, Layers, Palette } from 'lucide-react';

const navigation = [
    { name: 'Universal Restoration', path: '/universal', icon: Wand2, task: 'Task 1', color: 'text-cyan-500' },
    { name: 'Hard-Routed System', path: '/hard-routed', icon: GitBranch, task: 'Task 2', color: 'text-emerald-500' },
    { name: 'Soft MoE Restoration', path: '/soft-moe', icon: Layers, task: 'Task 3', color: 'text-purple-500' },
    { name: 'Face-to-Sketch', path: '/face-to-sketch', icon: Palette, task: 'Task 4', color: 'text-amber-500' },
];

const Sidebar = () => {
    const location = useLocation();

    return (
        <div className="w-64 bg-slate-900 text-white h-screen flex flex-col border-r border-slate-800">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-lg font-bold tracking-tight">GenAI Studio</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                    Image Restoration & Synthesis
                </p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navigation.map((item) => {
                    const isActive =
                        location.pathname === item.path ||
                        (item.path === '/universal' && location.pathname === '/');

                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ${isActive
                                    ? 'bg-slate-800 text-white font-medium shadow-sm'
                                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${item.color}`} />

                            <div className="flex flex-col">
                                <span className="text-sm">{item.name}</span>
                                <span className="text-[10px] opacity-60">
                                    {item.task}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800 text-center text-[10px] text-slate-500 font-mono">
                IEEE Academic Workspace v1.0
            </div>
        </div>
    );
};

export default Sidebar;