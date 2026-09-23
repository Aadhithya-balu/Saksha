import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  LayoutDashboard,
  Briefcase,
  Users,
  Network,
  Brain,
  MessageSquare,
  BarChart3,
  Shield,
  ChevronRight,
  Zap,
  Target,
  FileText,
  FolderOpen,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  HelpCircle,
  Workflow,
  Settings,
  Database,
  Rocket,
  MapPin,
  Heart,
  Upload,
  Gauge,
  KeyRound,
  AlertTriangle,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import { SearchInput } from '../components/ui/SearchInput';
import { Badge } from '../components/ui/Badge';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  category: string;
  content: React.ReactNode;
}

const sections: DocSection[] = [
  // Getting Started
  {
    id: 'login-guide',
    title: 'Login & Demo Credentials',
    icon: <KeyRound className="w-4 h-4" />,
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Sign in using your <strong className="text-[var(--text-primary)]">Badge ID</strong> and PIN on the
          secure access terminal. You can also toggle to <strong className="text-[var(--text-primary)]">Username</strong>{' '}
          login, or use the <strong className="text-[var(--text-primary)]">Face ID</strong> scanner for quick access.
          The following demo accounts are available for evaluation:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Username</th>
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Password</th>
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Role</th>
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Name</th>
              </tr>
            </thead>
            <tbody>
              {[
                { u: 'admin', p: '564738', role: 'admin', name: 'Admin User', v: 'coral' as const },
                { u: 'court_admin', p: '123456', role: 'court_admin', name: 'Registrar General', v: 'purple' as const },
                { u: 'magistrate', p: '123456', role: 'judicial_authority', name: 'Hon. Justice K. Rao', v: 'purple' as const },
                { u: 'court_analyst', p: '123456', role: 'court_analyst', name: 'Court Law Clerk', v: 'blue' as const },
                { u: 'SCRB-7740', p: '123456', role: 'crime_analyst', name: 'Priya Sharma', v: 'blue' as const },
                { u: 'IO-3921', p: '456789', role: 'investigator', name: 'Inspector Ravi Kumar', v: 'teal' as const },
                { u: 'SP-0088', p: '987654', role: 'inspector', name: 'Superintendent Arun Mehta', v: 'purple' as const },
              ].map((r, i) => (
                <tr key={i} className="border-b border-[var(--border-secondary)]">
                  <td className="py-2.5 px-3 font-mono text-[var(--text-primary)]">{r.u}</td>
                  <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">{r.p}</td>
                  <td className="py-2.5 px-3"><Badge variant={r.v} size="sm">{r.role}</Badge></td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          After signing in you land on the Analytics Dashboard. Use the sidebar to explore each module, and the
          AI Assistant (Chat) to query criminal records, cases and intelligence in plain language.
        </p>
      </div>
    ),
  },
  // Platform Overview
  {
    id: 'tech-stack',
    title: 'Technology Stack',
    icon: <Settings className="w-4 h-4" />,
    category: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Saksha is engineered as a modern, full-stack intelligence platform designed to be maintainable,
          scalable and audit-safe for law enforcement.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Frontend', tech: 'React 18 · TypeScript · Vite', desc: 'State via Zustand, queries via React Query, styling via Tailwind' },
            { label: 'Backend', tech: 'FastAPI · Python 3.12', desc: 'Async-capable REST API serving 75+ intelligence endpoints' },
            { label: 'Relational DB', tech: 'PostgreSQL 16 (Supabase)', desc: '16 tables covering cases, FIRs, evidence, officers and audit' },
            { label: 'Graph DB', tech: 'Neo4j 5.24 (Aura)', desc: '8 node types and 7 relationship types for network forensics' },
            { label: 'AI / ML', tech: 'LightGBM · XGBoost · scikit-learn', desc: '8 algorithms for hotspots, risk, repeat-offenders and anomalies' },
            { label: 'Auth & Security', tech: 'JWT (HS256) · SHA-256', desc: 'Token sessions, salted hashing, RBAC with granular permissions' },
            { label: 'Visualisation', tech: 'Recharts · D3 · Three.js · Mapbox', desc: 'Charts, heatmaps, 3D network graphs, geomaps and Deck.gl' },
            { label: 'Ops & ML', tech: 'Docker · GitHub Actions · Prometheus', desc: 'CI/CD, containerisation, model registry and drift monitoring' },
          ].map((s, i) => (
            <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{s.label}</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{s.tech}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'data-model',
    title: 'Data & Database Model',
    icon: <Database className="w-4 h-4" />,
    category: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Saksha stores operational records relationally and graph relationships in Neo4j. The two are kept in
          sync so both structured queries and graph traversals stay fast.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Core entities</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: 'Crime Cases', desc: 'Master case records linked to categories and locations' },
            { name: 'FIRs', desc: 'First Information Reports, linked to cases, criminals and victims' },
            { name: 'Criminals & Victims', desc: 'Profiles, aliases, MO summaries, identifiers and statements' },
            { name: 'Evidence', desc: 'Physical/digital items with chain-of-custody tracking' },
            { name: 'Officers', desc: 'Personnel, badge IDs, ranks and districts' },
            { name: 'Reports & Notifications', desc: 'Generated products and real-time intelligence alerts' },
            { name: 'Audit Logs', desc: 'Immutable trail of every user action' },
            { name: 'Interventions & Import Jobs', desc: 'Prevention programs and bulk-import audit (issue #139)' },
          ].map((d, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)]">
              <Database className="w-4 h-4 text-[var(--accent-teal)] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{d.name}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          If the graph database is unreachable, the platform gracefully falls back to SQL-based analytics so the
          command flow is never interrupted.
        </p>
      </div>
    ),
  },
  {
    id: 'multi-authority',
    title: 'Multi-Authority & Judicial Architecture',
    icon: <Shield className="w-4 h-4" />,
    category: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          SAKSHA incorporates multi-agency and judicial federation (Issue #286), enabling seamless,
          isolated, and role-governed collaboration across law enforcement, the judiciary, prosecution, and forensic labs.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              title: 'Authority Types & Scoping',
              desc: 'Explicit classification into LAW_ENFORCEMENT, COURT, PROSECUTION, FORENSIC, ANALYSIS, and SUPERVISORY with district and jurisdiction bounds.',
            },
            {
              title: 'Cross-Authority Case Sharing',
              desc: 'Cases are shared across agency boundaries strictly via audit-logged CaseAccess records with granular permission scopes (READ, ADMISSIBILITY_REVIEW, COMMENT).',
            },
            {
              title: 'Strict Judicial Neutrality',
              desc: 'When serving judicial roles (court_admin, judicial_authority, court_analyst), the AI assistant enforces non-accusatory language, framing data as evidence and allegations without prejudging guilt.',
            },
            {
              title: 'Chain of Custody & Admissibility',
              desc: 'Immutable custody logs and verified document analysis provide clean audit trails without exposing raw filesystem paths or compromising evidence integrity.',
            },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)]">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1">{item.title}</div>
              <div className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'how-ai-works',
    title: 'How the AI Works (MLOps)',
    icon: <Gauge className="w-4 h-4" />,
    category: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Every AI module follows the same lifecycle: models are <strong className="text-[var(--text-primary)]">trained on-demand</strong>{' '}
          from live database records, then persisted to a local model registry and <strong className="text-[var(--text-primary)]">auto-loaded</strong> on the next
          inference call. No external services are required for the core engine.
        </p>
        <div className="space-y-0">
          {[
            { step: 'Feature Extraction', desc: 'Understands raw records into numeric features (31 for hotspots, 10 for criminals, etc.)', color: 'var(--accent-blue)' },
            { step: 'Training', desc: 'LightGBM, RandomForest, XGBoost and custom NumPy models learn patterns from the database', color: 'var(--accent-purple)' },
            { step: 'Evaluation', desc: 'Reports accuracy, MAE, F1 and confidence metrics for every model', color: 'var(--accent-teal)' },
            { step: 'Registry & Versioning', desc: 'Artifacts saved with version metadata to the filesystem-backed model registry', color: 'var(--accent-amber)' },
            { step: 'Inference', desc: 'Models cached in-memory (lru_cache) and used to score predictions instantly', color: 'var(--accent-blue)' },
            { step: 'Monitoring & Drift', desc: 'Prometheus metrics and JSON drift rules detect when models need retraining', color: 'var(--accent-coral)' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: s.color, color: s.color }}>
                  <span className="text-xs font-bold">{i + 1}</span>
                </div>
                {i < 5 && <div className="w-px h-6 bg-[var(--border-primary)]" />}
              </div>
              <div className="pb-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{s.step}</div>
                <div className="text-xs text-[var(--text-muted)]">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 rounded-lg bg-[var(--accent-amber-subtle)] border border-[var(--accent-amber)]/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-[var(--accent-amber)] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Good to know</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                Model artifacts are trained automatically on first use, so the very first prediction on a fresh
                deployment may be slower while models warm up. Subsequent calls are fast.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'what-is-saksha',
    title: 'What is Saksha?',
    icon: <Shield className="w-4 h-4" />,
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p className="text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)]">Saksha</strong> is a comprehensive Crime Intelligence & Analytical Platform developed for the <strong className="text-[var(--text-primary)]">Karnataka State Police (KSP)</strong> as part of Datathon 2026. It transforms raw crime records into actionable intelligence through AI/ML-powered analytics, graph-based criminal network analysis, and real-time notifications.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[
            { icon: <Brain className="w-5 h-5 text-[var(--accent-blue)]" />, title: 'AI-Powered', desc: 'Predictive analytics, anomaly detection, and natural language queries' },
            { icon: <Network className="w-5 h-5 text-[var(--accent-purple)]" />, title: 'Graph Intelligence', desc: 'Visualize criminal networks, associations, and hidden connections' },
            { icon: <Zap className="w-5 h-5 text-[var(--accent-amber)]" />, title: 'Real-Time', desc: 'Live alerts, notifications, and dynamic dashboards' },
          ].map((f, i) => (
            <div key={i} className="sk-card p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3">{f.icon}</div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{f.title}</h4>
              <p className="text-xs text-[var(--text-muted)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'key-objectives',
    title: 'Key Objectives',
    icon: <Target className="w-4 h-4" />,
    category: 'Getting Started',
    content: (
      <div className="space-y-3">
        {[
          'Transform raw crime data into actionable intelligence for law enforcement',
          'Provide AI/ML-powered predictive analytics for crime hotspot identification',
          'Enable graph-based criminal network analysis and association mapping',
          'Deliver real-time notifications and alerts for active investigations',
          'Support data-driven decision making for policymakers and administrators',
          'Maintain a secure, role-based access control system for all users',
          'Generate comprehensive reports for legal proceedings and analysis',
        ].map((obj, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]/50">
            <CheckCircle className="w-4 h-4 text-[var(--accent-teal)] shrink-0 mt-0.5" />
            <span className="text-sm text-[var(--text-secondary)]">{obj}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'user-roles',
    title: 'User Roles & Access',
    icon: <Users className="w-4 h-4" />,
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">Saksha supports 7 distinct user roles with different access levels:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Role</th>
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Access Level</th>
              </tr>
            </thead>
            <tbody>
              {[
                { role: 'Admin', access: 'Full system access, user management, settings', variant: 'coral' as const },
                { role: 'Crime Analyst (SCRB)', access: 'All read routes, dashboard, AI analytics, reports', variant: 'blue' as const },
                { role: 'Investigator (IO)', access: 'CRUD for crimes, FIRs, criminals, victims, evidence', variant: 'teal' as const },
                { role: 'Inspector', access: 'Extended investigator + officer management', variant: 'purple' as const },
                { role: 'Policymaker (SP)', access: 'Read-only dashboard, AI analytics, reports', variant: 'amber' as const },
                { role: 'Officer', access: 'Basic read access + evidence handling', variant: 'info' as const },
                { role: 'Viewer', access: 'Read-only access to all modules', variant: 'default' as const },
              ].map((r, i) => (
                <tr key={i} className="border-b border-[var(--border-secondary)]">
                  <td className="py-2.5 px-3"><Badge variant={r.variant} size="sm">{r.role}</Badge></td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{r.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  // Platform Overview
  {
    id: 'architecture',
    title: 'System Architecture',
    icon: <LayoutDashboard className="w-4 h-4" />,
    category: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">Saksha is built on a modern full-stack architecture:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Frontend', tech: 'React 18 + TypeScript + Vite', desc: 'Single-page application with responsive design' },
            { label: 'Backend', tech: 'FastAPI (Python 3.12)', desc: 'RESTful API with 59+ endpoints' },
            { label: 'Database', tech: 'PostgreSQL 16 (Supabase)', desc: '16 relational tables for structured data' },
            { label: 'Graph DB', tech: 'Neo4j 5.24 (Aura)', desc: '8 node types, 7 relationship types for network analysis' },
            { label: 'AI/ML', tech: 'LightGBM, XGBoost, scikit-learn', desc: '8 AI algorithms for prediction and analysis' },
            { label: 'Authentication', tech: 'JWT + SHA-256', desc: 'Secure token-based auth with role-based access' },
          ].map((s, i) => (
            <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{s.label}</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{s.tech}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'ai-capabilities',
    title: 'AI Capabilities',
    icon: <Brain className="w-4 h-4" />,
    category: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">Saksha integrates 8 distinct AI/ML algorithms:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: 'Crime Hotspot Prediction', algo: 'LightGBM + Optuna', desc: 'Predicts future crime hotspots using spatial and temporal features' },
            { name: 'District Risk Scoring', algo: 'RandomForest', desc: 'Scores districts by crime risk based on historical patterns' },
            { name: 'Crime Forecasting', algo: 'XGBoost/LightGBM', desc: 'Time-series forecasting of crime trends over 6-12 months' },
            { name: 'Criminal Risk Assessment', algo: 'Weighted Linear', desc: 'Calculates individual criminal risk scores from behavior patterns' },
            { name: 'Repeat Offender Prediction', algo: 'Logistic Regression', desc: 'Predicts likelihood of reoffending based on criminal history' },
            { name: 'Similar Offender Matching', algo: 'Cosine Similarity KNN', desc: 'Finds similar offenders based on crime patterns and MO' },
            { name: 'Criminal Clustering', algo: 'Mini k-means', desc: 'Groups criminals by behavioral patterns and connections' },
            { name: 'Anomaly Detection', algo: 'Z-score L2 Deviation', desc: 'Detects unusual patterns in crime data and officer activity' },
          ].map((a, i) => (
            <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{a.name}</span>
              </div>
              <Badge variant="purple" size="xs">{a.algo}</Badge>
              <p className="text-xs text-[var(--text-muted)] mt-2">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // Module Guides
  {
    id: 'dashboard-guide',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          The Overview Dashboard is your command center, providing a real-time snapshot of crime intelligence across Karnataka.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Key Features:</h4>
        <ul className="space-y-2">
          {[
            'KPI Cards: Total crimes, active cases, resolved cases, and officer count',
            'Crime Trend Chart: Monthly crime trend visualization with category breakdown',
            'Hotspot Map: Interactive spatial visualization of crime hotspots',
            'Forecast Chart: AI-predicted crime trends for the next 6 months',
            'Alert Feed: Real-time anomaly and critical alerts',
            'Risk Scores: District-level risk assessment with color-coded indicators',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <ChevronRight className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'cases-guide',
    title: 'Crime Cases',
    icon: <Briefcase className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Crime Cases provides comprehensive case management for all registered criminal cases in Karnataka.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">What you can do:</h4>
        <ul className="space-y-2">
          {[
            'View and filter all crime cases by category, district, status, and priority',
            'Create new crime cases with linked FIRs, criminals, and victims',
            'Track case progress with visual progress indicators',
            'View case details including modus operandi, evidence, and investigation notes',
            'Access AI-powered case recommendations and insights',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-teal)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'network-guide',
    title: 'Network Analysis',
    icon: <Network className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          The Network Graph module provides 3D visualization of criminal networks and associations stored in Neo4j.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Capabilities:</h4>
        <ul className="space-y-2">
          {[
            'Interactive 3D graph visualization with force-directed layout',
            'Explore criminal associations, gang networks, and known associates',
            'Shortest path analysis between any two entities',
            'Link analysis for discovering hidden connections',
            'AI-powered graph insights for pattern detection',
            'Timeline slider to see network evolution over time',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <Network className="w-3.5 h-3.5 text-[var(--accent-purple)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'ai-chat-guide',
    title: 'AI Assistant',
    icon: <MessageSquare className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          The AI Chat Assistant provides natural language access to crime data and analytics. Ask questions in plain English and get instant answers.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Example Queries:</h4>
        <div className="space-y-2">
          {[
            { q: '"Show me all cyber crimes in Bengaluru"', desc: 'Returns filtered case data' },
            { q: '"What is the risk score for district Mysuru?"', desc: 'AI risk assessment lookup' },
            { q: '"Who are the known associates of Ramu Swamy?"', desc: 'Network graph query' },
            { q: '"Predict crime hotspots for next quarter"', desc: 'AI prediction with visualization' },
            { q: '"Generate a summary report for FIR-2026-001"', desc: 'Automated report generation' },
          ].map((ex, i) => (
            <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)]">
              <div className="text-sm font-medium text-[var(--text-primary)] font-mono">{ex.q}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{ex.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-[var(--accent-amber-subtle)] border border-[var(--accent-amber)]/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-[var(--accent-amber)] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Tip</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">The AI Assistant uses RAG (Retrieval-Augmented Generation) to search case data, criminal records, and analytics before generating responses. All answers include source citations.</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'investigation-workflow',
    title: 'Investigation Module',
    icon: <Workflow className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-[var(--text-secondary)]">
          The Investigation module is a unified, officer-centric dossier for any case. Search the case list,
          open a dossier, and get the full investigation context alongside an analytical modus-operandi (MO)
          matching engine — every value derived live from the police database.
        </p>

        <h4 className="text-sm font-semibold text-[var(--text-primary)]">End-to-end workflow</h4>
        <div className="space-y-0">
          {[
            { step: 'Crime Registration', desc: 'Report filed as FIR, linked to crime case', icon: <FileText className="w-4 h-4" />, color: 'var(--accent-blue)' },
            { step: 'Investigation', desc: 'IO assigned, evidence collected, timeline tracked', icon: <Search className="w-4 h-4" />, color: 'var(--accent-purple)' },
            { step: 'Evidence Analysis', desc: 'Digital and physical evidence catalogued with chain-of-custody', icon: <FolderOpen className="w-4 h-4" />, color: 'var(--accent-teal)' },
            { step: 'MO Matching', desc: 'Cases and offenders matched by weighted MO similarity', icon: <Brain className="w-4 h-4" />, color: 'var(--accent-blue)' },
            { step: 'Network Mapping', desc: 'Criminal associations and gang links identified', icon: <Network className="w-4 h-4" />, color: 'var(--accent-purple)' },
            { step: 'Reports & Closure', desc: 'Final report generated, case status updated', icon: <BarChart3 className="w-4 h-4" />, color: 'var(--accent-teal)' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: s.color, color: s.color }}>
                  {s.icon}
                </div>
                {i < 5 && <div className="w-px h-6 bg-[var(--border-primary)]" />}
              </div>
              <div className="pb-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{s.step}</div>
                <div className="text-xs text-[var(--text-muted)]">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Search & dossier</h4>
        <ul className="space-y-2">
          {[
            'Search cases by number or description and filter by status',
            'Open a dossier: case header with status/priority, progress bar, dates and assigned officer',
            'Linked FIRs, criminals (with risk scores), evidence and a chronological investigation timeline',
            'AI recommendations computed from real data — case severity, open FIR counts, evidence forensics, aging alerts and MO-pattern leads',
            'Ask the AI chat panel about the case, evidence and possible leads',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <ChevronRight className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>

        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Analytical tabs</h4>
        <p className="text-sm text-[var(--text-secondary)]">
          The MO engine is organised into three tabs — <strong className="text-[var(--text-primary)]">Ranked Matches</strong>,
          <strong className="text-[var(--text-primary)]"> Statewide Clusters</strong> and{' '}
          <strong className="text-[var(--text-primary)]">Deep Compare</strong>.
        </p>

        <h5 className="text-sm font-semibold text-[var(--text-primary)] mt-3">Ranked Matches</h5>
        <ul className="space-y-2">
          {[
            'Live-ranked suspects and serial cases for the current case, with a toolbar showing how many cases and offenders were evaluated',
            'Sort by similarity, confidence or status; filter by minimum match threshold (10 – 75%), confidence (all / medium / high) and free-text search on name or station',
            'Confirmed FIR accused are flagged separately from analytical leads so evidence-based links stay distinct from intelligence suggestions',
            'Opening a match reveals an analysis drawer: match percentage, algorithm confidence, Verified Matching Factors, a Comparative Attribute Matrix, divergent factors and attribute-evaluation coverage',
            'A context menu per result offers Deep Compare, switching the investigation to that case, or viewing its timeline',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-coral)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>

        <h5 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mt-4">
          <Layers className="w-4 h-4 text-[var(--accent-teal)] shrink-0" /> Statewide Clusters
        </h5>
        <ul className="space-y-2">
          {[
            'Unsupervised tactical mining groups cases and offenders statewide whose MO signatures overlap (Jaccard similarity ≥ 0.34 or ≥ 2 shared canonical tags, connected via union-find)',
            'Selectable cluster cards list each cluster\'s display name, case-count badge, a cases · suspects · districts summary, a preview chip strip of the key MO tags (expandable), the peak time window and how many members are at large',
            'Selecting a card opens a detail panel with five stat tiles (Related Cases, Subjects, At-Large, Threat Score, Districts), a dominant-category badge, a threat-score badge, the full Key MO Patterns chip strip, geographic spread, the relevant crime category and time period, and an Associated Entities list',
            'From the Associated Entities list officers can open a dossier, view a case, or jump to that criminal\'s network graph in one click',
            'Clusters are ranked by a documented threat heuristic incorporating support, criminal count, at-large members, shared tags and violent indicators',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <Shield className="w-3.5 h-3.5 text-[var(--accent-teal)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>

        <h5 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mt-4">
          <SlidersHorizontal className="w-4 h-4 text-[var(--accent-purple)] shrink-0" /> Deep Compare
        </h5>
        <ul className="space-y-2">
          {[
            'A dedicated Multi-Feature Side-by-Side view comparing the current subject with any selected record, opened from a result or its context menu',
            'A score summary banner reports the overall similarity % and match confidence (high ≥ 75%, medium 50 – 74%, low 30 – 49%)',
            'A fixed-layout comparison matrix walks five dimensions — Crime Category, Operating Time Window, Geographic Jurisdiction, Target Environment and Tactical Methods & MO Tags',
            'Every row carries a standardised live status — ✓ Match, △ Partial, ✕ Mismatch, ✓ Same District, ✓ Same Station or — No Data — derived from real field comparisons and tag-set overlap rather than stored judgments',
            'Tactical methods render as compact expandable MO-tag chips; Matching Factors and Divergent Factors panels explain the overall verdict',
            'The underlying engine scores seven weighted features over real records — MO tags 35%, crime category 20%, weapons 15%, time window 10%, location 10%, target environment 5%, vehicles 5%',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-purple)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>

        <div className="p-3 rounded-lg bg-[var(--accent-amber-subtle)] border border-[var(--accent-amber)]/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-[var(--accent-amber)] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Data provenance</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                Every score, match and cluster is computed live from platform records — cases, FIRs,
                criminals, locations, evidence and normalized MO tags. Attributes that were never logged
                are reported as "insufficient data"; the platform never fabricates values, percentages or
                trends.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'hotspots-guide',
    title: 'Crime Hotspots',
    icon: <MapPin className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          The Hotspots module visualises where crime is concentrated across Karnataka using an interactive map
          with an overlay heatmap, and predicts future hotspots with a time slider.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Capabilities:</h4>
        <ul className="space-y-2">
          {[
            'Interactive Karnataka SVG map with crime heatmap overlay',
            'Draggable time slider to inspect crime intensity over days/hours',
            'AI hotspot prediction model trained on spatial and temporal features (H3 indices, rolling averages)',
            'Drill-down by district, category and date range',
            'Colour-coded intensity bands from ambient to critical',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-amber)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'offenders-guide',
    title: 'Offenders & Criminals',
    icon: <Users className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          The Criminal Dossiers module delivers an intelligence file per offender, merging biographical
          profiles with live AI risk scoring, recidivism prediction and behaviourally similar offenders.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">What you can do:</h4>
        <ul className="space-y-2">
          {[
            'Search and review offender dossiers with aliases, DOB and identifying marks',
            'View AI risk score, risk band and the top contributing risk factors',
            'See recidivism probability and repeat-offender trigger flags',
            'Explore behaviourally similar offenders matched by modus operandi',
            'Visualise the associate & scene network diagram and jump to linked profiles',
            'Generate AI investigation recommendations for each subject',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-coral)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'victims-guide',
    title: 'Victims & Victimology',
    icon: <Heart className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          The Victims module indexes victim and witness records and adds a Victimology analytics layer covering
          repeat-victimisation and a composite vulnerability index.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Analytics provided:</h4>
        <ul className="space-y-2">
          {[
            'Repeat-victimization rate and gender split across the state',
            'Repeat-victim registry filtered by minimum FIR count',
            'Composite vulnerability index with cited risk factors',
            'Victim identity, contact and statement records with linked cases',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <Heart className="w-3.5 h-3.5 text-[var(--accent-teal)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'data-import-guide',
    title: 'Data Import & Template',
    icon: <Upload className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Administrators can bulk-load records from CSV or XLSX using the Data Import module, with a guided
          template, column mapping preview and an audit trail of every import job.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Workflow:</h4>
        <ul className="space-y-2">
          {[
            'Download a supported entity template (CSV or XLSX) with the correct column profile',
            'Upload a file to the preview stage which parses and validates rows',
            'Review the column mapping and the per-row report (valid / invalid / warnings)',
            'Commit valid rows (with an optional dry-run) to persist them safely',
            'Track every import via the job audit trail with entity type and status',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <Upload className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'reports-guide',
    title: 'Reports Center',
    icon: <BarChart3 className="w-4 h-4" />,
    category: 'Module Guides',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          The Reports Center assembles structured intelligence products for a case or dataset, lets you preview
          them, and exports to multiple formats used in legal and administrative workflows.
        </p>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Capabilities:</h4>
        <ul className="space-y-2">
          {[
            'Generate on-demand reports from live case and analytics data',
            'Preview reports before finalising',
            'Export to PDF, DOCX, TXT, CSV and XLSX',
            'Include AI-generated summaries, statistics and case narrative',
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-purple)] shrink-0 mt-1" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    icon: <Shield className="w-4 h-4" />,
    category: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Saksha treats data protection and accountability as first-class requirements, designed for government
          intelligence workloads.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: 'JWT Sessions', desc: 'HS256-signed tokens with role claims; sessions expire securely' },
            { name: 'Salted Hashing', desc: 'SHA-256 with per-user salt for password storage — never plaintext' },
            { name: 'RBAC', desc: '7 roles with granular route-level permission guards' },
            { name: 'Audit Trail', desc: 'Every page view and action logged with user, badge and resource' },
            { name: 'Chain of Custody', desc: 'Evidence assignments and transfers tracked end-to-end' },
            { name: 'Least Privilege', desc: 'RoleGuard on the frontend and protected routes on the backend' },
          ].map((s, i) => (
            <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)]">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--accent-teal)] shrink-0" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">{s.name}</span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'get-started',
    title: 'First Steps',
    icon: <Rocket className="w-4 h-4" />,
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">A quick orientation for new users of the platform.</p>
        <div className="space-y-0">
          {[
            { step: 'Log In', desc: 'Use your Badge ID + PIN, username, or Face ID from the secure access terminal' },
            { step: 'Explore the Dashboard', desc: 'Review KPIs, trends, hotspot map, forecast and the live alert feed' },
            { step: 'Open a Case', desc: 'Search crime cases and open an investigation dossier with AI recommendations' },
            { step: 'Use the AI Assistant', desc: 'Ask questions about cases, criminals and analytics in plain language' },
            { step: 'Generate a Report', desc: 'Assemble and export a PDF/DOCX/CSV product for your workflow' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}>
                  <span className="text-xs font-bold">{i + 1}</span>
                </div>
                {i < 4 && <div className="w-px h-6 bg-[var(--border-primary)]" />}
              </div>
              <div className="pb-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{s.step}</div>
                <div className="text-xs text-[var(--text-muted)]">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // FAQ
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    icon: <HelpCircle className="w-4 h-4" />,
    category: 'FAQ',
    content: (
      <div className="space-y-4">
        {[
          { q: 'How do I log in to Saksha?', a: 'Use your Badge ID and PIN on the login page. Contact your administrator if you need credentials. You can also use Face ID authentication for quick access.' },
          { q: 'What browsers are supported?', a: 'Saksha supports Chrome, Firefox, Safari, and Edge (latest versions). For the best experience, use Chrome or Firefox.' },
          { q: 'How often is the data updated?', a: 'Crime data is synced in real-time from the PostgreSQL database. AI models are retrained weekly via the MLOps pipeline.' },
          { q: 'Can I export data?', a: 'Yes, most modules support CSV and PDF exports. Go to Reports Center for comprehensive report generation.' },
          { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit (HTTPS) and at rest. Authentication uses JWT tokens with role-based access control. The platform follows government security standards.' },
          { q: 'What do the AI predictions mean?', a: 'AI predictions are based on historical crime patterns and should be used as intelligence aids, not definitive conclusions. Always verify with field intelligence.' },
          { q: 'How do I report a bug or request a feature?', a: 'Contact your system administrator or use the Settings page to submit feedback. For critical issues, use the emergency contact channels.' },
        ].map((faq, i) => (
          <details key={i} className="group">
            <summary className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-secondary)] cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors list-none">
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-open:rotate-90 transition-transform" />
              <span className="text-sm font-medium text-[var(--text-primary)]">{faq.q}</span>
            </summary>
            <div className="mt-2 ml-6 p-3 text-sm text-[var(--text-secondary)] leading-relaxed">
              {faq.a}
            </div>
          </details>
        ))}
      </div>
    ),
  },
];

const categories = ['Getting Started', 'Platform Overview', 'Module Guides', 'FAQ'];

export const DocsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('what-is-saksha');

  const filtered = search
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.category.toLowerCase().includes(search.toLowerCase())
      )
    : sections;

  const activeDoc = sections.find((s) => s.id === activeSection);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-160px)]">
      {/* Left Sidebar Navigation */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="sticky top-0 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[var(--accent-blue)]" />
              Documentation
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Learn how to use the Saksha platform</p>
          </div>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search docs..."
            size="sm"
          />

          <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {categories.map((cat) => {
              const catSections = filtered.filter((s) => s.category === cat);
              if (catSections.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-[10px] font-semibold tracking-[0.1em] text-[var(--text-disabled)] uppercase mb-2 px-3">
                    {cat}
                  </div>
                  <div className="space-y-0.5">
                    {catSections.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                          activeSection === s.id
                            ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue-light)] font-medium'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {s.icon}
                        <span className="truncate">{s.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {activeDoc && (
          <div className="sk-card-elevated sk-page-enter" key={activeDoc.id}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue)]/20 flex items-center justify-center text-[var(--accent-blue)]">
                {activeDoc.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{activeDoc.title}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="blue" size="xs">{activeDoc.category}</Badge>
                </div>
              </div>
            </div>
            {activeDoc.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocsPage;
