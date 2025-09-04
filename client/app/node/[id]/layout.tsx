'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/sidebar';
import { Node } from '@/lib/db-json';
import { apiCall } from '@/lib/api';

export default function NodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [currentNode, setCurrentNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/nodes')
      .then(res => res.json())
      .then(data => {
        setNodes(data);
        const node = data.find((n: Node) => n.id === parseInt(params.id as string));
        if (node) {
          setCurrentNode(node);
        } else {
          router.push('/');
        }
        setLoading(false);
      });
  }, [params.id, router]);

  const handlePowerAction = async (action: 'reboot' | 'shutdown') => {
    if (!currentNode) return;
    
    const confirmed = confirm(`Are you sure you want to ${action} ${currentNode.name}?`);
    if (!confirmed) return;
    
    const result = await apiCall(
      currentNode.url,
      `/power/${action}`,
      currentNode.apiKey,
      { method: 'POST' }
    );
    
    if (result.error) {
      alert(`Failed to ${action}: ${result.error}`);
    } else {
      alert(`${action} command sent successfully`);
    }
  };

  if (loading || !currentNode) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar 
        nodes={nodes} 
        currentNode={currentNode} 
        onPowerAction={handlePowerAction}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}