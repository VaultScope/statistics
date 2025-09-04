'use client';

import { Node } from '@/lib/db-json';
import { ChevronDown, Cpu, Key, Network, Power, RotateCcw, Server, Activity, GitFork, FileText, Users, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface SidebarProps {
  nodes: Node[];
  currentNode: Node;
  onPowerAction?: (action: 'reboot' | 'shutdown') => void;
}

export default function Sidebar({ nodes, currentNode, onPowerAction }: SidebarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const menuItems = [
    { href: `/node/${currentNode.id}`, label: 'Overview', icon: Activity },
    { href: `/node/${currentNode.id}/hardware`, label: 'Hardware', icon: Cpu },
    { href: `/node/${currentNode.id}/process`, label: 'Process', icon: Server },
    { href: `/node/${currentNode.id}/network`, label: 'Network', icon: Network },
    { href: `/node/${currentNode.id}/apikeys`, label: 'API Keys', icon: Key },
    { href: `/node/${currentNode.id}/logs`, label: 'Logs', icon: FileText },
  ];

  return (
    <aside className="flex flex-col w-64 h-screen border-r bg-card border-border">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center justify-between w-full px-4 py-2 transition-colors rounded-lg bg-secondary hover:bg-muted"
          >
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4" />
              <span className="truncate">{currentNode.name}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {dropdownOpen && (
            <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden border rounded-lg top-full bg-secondary border-border">
              {nodes.map((node) => (
                <Link
                  key={node.id}
                  href={`/node/${node.id}`}
                  onClick={() => setDropdownOpen(false)}
                  className="block px-4 py-2 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{node.name}</span>
                    <span className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center mt-4 space-x-2">
          <button
            onClick={() => onPowerAction?.('reboot')}
            className="flex items-center justify-center flex-1 px-3 py-2 space-x-1 text-white transition-colors bg-yellow-600 rounded-lg hover:bg-yellow-700"
            title="Reboot"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reboot</span>
          </button>
          <button
            onClick={() => onPowerAction?.('shutdown')}
            className="flex items-center justify-center flex-1 px-3 py-2 space-x-1 text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
            title="Shutdown"
          >
            <Power className="w-4 h-4" />
            <span>Shutdown</span>
          </button>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary text-muted-foreground hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-border">
        <Link
          href="/"
          className="flex items-center px-4 py-2 space-x-2 transition-colors rounded-lg hover:bg-secondary text-muted-foreground hover:text-white"
        >
          <Server className="w-4 h-4" />
          <span>All Nodes</span>
        </Link>
        <Link
          href="https://github.com/VaultScope/Statistics"
          className="flex items-center px-4 py-2 space-x-2 transition-colors rounded-lg hover:bg-secondary text-muted-foreground hover:text-white"
          target="_blank"
        >
          <GitFork className="w-4 h-4" />
          <span>GitHub</span>
        </Link>
        <Link
          href="/settings"
          className="flex items-center px-4 py-2 space-x-2 transition-colors rounded-lg hover:bg-secondary text-muted-foreground hover:text-white"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}