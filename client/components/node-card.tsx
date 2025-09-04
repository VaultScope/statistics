'use client';

import { Node } from '@/lib/db-json';
import { Activity, AlertCircle, CheckCircle, Server } from 'lucide-react';
import Link from 'next/link';

interface NodeCardProps {
  node: Node;
}

export default function NodeCard({ node }: NodeCardProps) {
  const isOnline = node.status === 'online';
  
  return (
    <Link href={`/node/${node.id}`}>
      <div className="bg-card border border-border rounded-25 p-6 hover:border-muted transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Server className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">{node.name}</h3>
          </div>
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={`text-sm ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Category</span>
            <span className="text-white">{node.category}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>URL</span>
            <span className="text-white truncate max-w-[200px]">{node.url}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last Check</span>
            <span className="text-white">
              {new Date(node.lastCheck).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}