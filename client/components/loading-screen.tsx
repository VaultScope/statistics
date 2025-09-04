import React from 'react';
import { LucideIcon } from 'lucide-react';

interface LoadingStep {
  icon: LucideIcon;
  label: string;
  done: boolean;
  current?: boolean;
}

interface LoadingScreenProps {
  title: string;
  message: string;
  progress: number;
  total: number;
  icon: LucideIcon;
  steps?: LoadingStep[];
}

export default function LoadingScreen({
  title,
  message,
  progress,
  total,
  icon: Icon,
  steps = []
}: LoadingScreenProps) {
  const percentage = Math.round((progress / total) * 100);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-primary/10">
            <Icon className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-muted-foreground">{message}</p>
        </div>
        
        <div className="space-y-4">
          <div className="relative">
            <div className="flex mb-2 items-center justify-between">
              <span className="text-xs font-semibold inline-block text-primary">
                Progress
              </span>
              <span className="text-xs font-semibold inline-block text-primary">
                {percentage}%
              </span>
            </div>
            <div className="overflow-hidden h-2 text-xs flex rounded-full bg-secondary">
              <div
                style={{ width: `${percentage}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out"
              />
            </div>
          </div>
          
          {steps.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-6">
              {steps.map(({ icon: StepIcon, label, done, current }) => (
                <div
                  key={label}
                  className={`flex items-center space-x-2 p-2 rounded-lg transition-all ${
                    done ? 'bg-primary/10 text-primary' : 'bg-secondary/50 text-muted-foreground'
                  }`}
                >
                  <StepIcon className={`w-4 h-4 ${done ? 'animate-none' : current ? 'animate-spin' : ''}`} />
                  <span className="text-sm">{label}</span>
                  {done && (
                    <svg className="w-4 h-4 ml-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}