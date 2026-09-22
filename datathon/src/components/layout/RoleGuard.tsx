import React from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { Lock, ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  path: string;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ path, children }) => {
  const { checkPermission, getRequiredRoles, user } = useRBAC();

  const isAllowed = checkPermission(path);

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-[#C94A2A] mb-4 animate-bounce" />
        <h3 className="text-lg font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">Authentication Required</h3>
        <p className="text-xs font-mono text-[var(--text-muted)] mt-2">Sign in to view this module.</p>
      </div>
    );
  }

  if (!isAllowed) {
    const requiredRoles = getRequiredRoles(path);

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center select-none">
        {/* Glowing 3D Lock Shield Representation */}
        <div className="relative mb-6 group">
          {/* External rotating shield border elements */}
          <div className="absolute inset-[-15px] rounded-full border border-dashed border-[#C94A2A]/40 animate-[spin_30s_linear_infinite] pointer-events-none" />
          <div className="absolute inset-[-8px] rounded-full border-t border-b border-[#C94A2A]/20 animate-[spin_10s_linear_infinite] pointer-events-none" />
          
          {/* Outer glowing frame */}
          <div className="w-24 h-24 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center border border-[#C94A2A]/40 shadow-glow-coral relative group-hover:scale-105 transition-transform duration-300">
            <Lock className="w-10 h-10 text-[#C94A2A] animate-pulse" />
          </div>
          
          {/* Keyhole overlay sparks */}
          <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-[#C94A2A] rounded-full -translate-x-1/2 -translate-y-1/2 animate-ping" />
        </div>

        <h2 className="text-md font-mono font-extrabold text-[#C94A2A] uppercase tracking-[0.2em]">
          Access Restriction Triggered
        </h2>
        
        <div className="max-w-md bg-[#C94A2A]/5 border border-[#C94A2A]/20 p-4 rounded-card mt-4 flex flex-col gap-3 font-mono">
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Your credentials <span className="text-orange-400 font-bold">[{user.badgeId}]</span> do not grant security permissions for this intelligence module.
          </p>

          <div className="h-[1px] bg-[var(--bg-elevated)] w-full" />
          
          <div className="text-[9.5px] text-[var(--text-muted)] flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>REQUIRED ENCR-CLEARANCE: <span className="text-[var(--text-primary)] font-semibold">{requiredRoles.join(' / ')}</span></span>
          </div>

          <div className="text-[9.5px] text-[var(--text-muted)] flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Blocked by your role policy for this module</span>
          </div>
        </div>
      </div>
    );
  }

  // Permission granted
  return <>{children}</>;
};

export default RoleGuard;
