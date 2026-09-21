export type Language = 'en' | 'kn' | 'kn-en';

export interface TranslationSet {
  // Navigation
  nav_dashboard: string;
  nav_command_center: string;
  nav_intelligence: string;
  nav_intelligence_engine: string;
  nav_intelligence_fusion: string;
  nav_fir: string;
  nav_hotspot: string;
  nav_network: string;
  nav_predictive: string;
  nav_anomaly: string;
  nav_crime_cases: string;
  nav_investigation: string;
  nav_notifications: string;
  nav_offenders: string;
  nav_criminals: string;
  nav_victims: string;
  nav_officers: string;
  nav_evidence: string;
  nav_reports: string;
  nav_sociological: string;
  nav_strategic: string;
  nav_ai_chat: string;
  nav_settings: string;
  nav_admin: string;
  nav_docs: string;
  nav_identity: string;
  nav_face_recognition: string;

  // Common actions
  action_search: string;
  action_save: string;
  action_cancel: string;
  action_delete: string;
  action_edit: string;
  action_create: string;
  action_export: string;
  action_filter: string;
  action_back: string;
  action_close: string;
  action_confirm: string;
  action_loading: string;
  action_refresh: string;
  action_view: string;
  action_add: string;

  // FIR page
  fir_title: string;
  fir_subtitle: string;
  fir_directory: string;
  fir_search_hint: string;
  fir_complainant: string;
  fir_contact: string;
  fir_sections: string;
  fir_narrative: string;
  fir_status_registered: string;
  fir_status_inquiry: string;
  fir_status_resolved: string;
  fir_accused: string;
  fir_victims: string;
  fir_no_fir_selected: string;
  fir_select_hint: string;
  fir_create_new: string;
  fir_edit: string;
  fir_purge: string;
  fir_build_intelligence: string;
  fir_case_link: string;
  fir_officer: string;
  fir_unassigned: string;
  fir_risk_index: string;

  // Criminals page
  criminal_title: string;
  criminal_subtitle: string;
  criminal_index: string;
  criminal_search_hint: string;
  criminal_status: string;
  criminal_risk: string;
  criminal_aliases: string;
  criminal_dob: string;
  criminal_gender: string;
  criminal_gang: string;
  criminal_address: string;
  criminal_marks: string;
  criminal_mo: string;
  criminal_linked_cases: string;
  criminal_network: string;
  criminal_similar: string;
  criminal_open_dossier: string;
  criminal_build_intelligence: string;

  // Investigation page
  investigation_title: string;
  investigation_subtitle: string;
  investigation_cases: string;
  investigation_search: string;
  investigation_detail: string;
  investigation_timeline: string;
  investigation_firs: string;
  investigation_criminals: string;
  investigation_evidence: string;
  investigation_ai_recommendations: string;
  investigation_ai_chat: string;
  investigation_mo_patterns: string;

  // Intelligence Engine
  intel_title: string;
  intel_subtitle: string;
  intel_build: string;
  intel_building: string;
  intel_summary: string;
  intel_connections: string;
  intel_common_threads: string;
  intel_case_comparison: string;
  intel_crime_dna: string;
  intel_investigation_leads: string;
  intel_timeline: string;
  intel_network: string;
  intel_pattern_breaks: string;
  intel_anomalies: string;
  intel_evidence_trail: string;
  intel_confidence: string;
  intel_confirmed: string;
  intel_probable: string;
  intel_possible: string;
  intel_insufficient_data: string;
  intel_explainability: string;
  intel_supporting_records: string;
  intel_start_hint: string;
  intel_select_entity: string;
  intel_no_connections: string;
  intel_no_threads: string;
  intel_no_leads: string;
  intel_pattern_baseline: string;
  intel_pattern_deviation: string;
  intel_new_analysis: string;
  intel_search_placeholder: string;
  intel_capabilities: string;
  intel_recent_analyses: string;
  intel_no_history: string;
  intel_no_history_hint: string;
  intel_loading_history: string;
  intel_searching: string;
  intel_no_results: string;
  intel_no_results_hint: string;
  intel_entities: string;
  intel_remove_history: string;
  intel_start_any: string;

  // Dashboard
  dashboard_title: string;
  dashboard_subtitle: string;
  dashboard_total_cases: string;
  dashboard_active_firs: string;
  dashboard_open_cases: string;
  dashboard_risk_alerts: string;

  // Common UI
  ui_no_data: string;
  ui_error: string;
  ui_retry: string;
  ui_empty_state: string;
  ui_confirm_delete: string;
  ui_filter_all: string;
  ui_status_open: string;
  ui_status_closed: string;
  ui_status_active: string;
  ui_priority_critical: string;
  ui_priority_high: string;
  ui_priority_medium: string;
  ui_priority_low: string;

  // Settings
  settings_title: string;
  settings_profile: string;
  settings_system: string;
  settings_help: string;
  settings_language: string;
  settings_language_preference: string;
  settings_language_hint: string;
  settings_english: string;
  settings_kannada: string;
  settings_kanglish: string;
  settings_ai_language_note: string;

  // Evidence
  evidence_title: string;
  evidence_chain: string;
  evidence_upload: string;
  evidence_type: string;
  evidence_no_data: string;
  evidence_search_hint: string;
  evidence_status: string;
  evidence_officer: string;
  evidence_upload_date: string;
  evidence_hash: string;

  // Crime Cases
  cc_title: string;
  cc_subtitle: string;
  cc_create: string;
  cc_search_hint: string;
  cc_all_status: string;
  cc_all_categories: string;
  cc_all_districts: string;
  cc_all_priorities: string;
  cc_case_details: string;
  cc_occurred_at: string;
  cc_status: string;
  cc_priority: string;
  cc_progress: string;
  cc_actions: string;
  cc_view: string;
  cc_edit: string;
  cc_purge: string;
  cc_no_cases: string;
  cc_no_description: string;
  cc_reset: string;
  cc_back: string;
  cc_description: string;
  cc_category: string;
  cc_district: string;
  cc_assigned_officer: string;
  cc_investigation_notes: string;
  cc_add_note: string;
  cc_linked_firs: string;
  cc_link_fir: string;
  cc_ai_insights: string;

  // Reports
  reports_title: string;
  reports_generate: string;
  reports_export: string;

  // Notifications
  notifications_title: string;
  notifications_unread: string;
  notifications_mark_read: string;

  // Login
  login_title: string;
  login_subtitle: string;
  login_badge_hint: string;
  login_face_auth: string;

  // Footer
  footer_version: string;
  footer_stamp: string;

  // Hotspots page
  page_hotspot_title: string;
  page_hotspot_subtitle: string;
  page_hotspot_loading: string;
  page_hotspot_vector_map: string;
  page_hotspot_matrix: string;
  page_hotspot_export: string;
  page_hotspot_emerging_alerts: string;
  page_hotspot_red_zone: string;

  // Predictions page
  page_predict_title: string;
  page_predict_loading: string;
  page_predict_seasonal: string;
  page_predict_emerging: string;
  page_predict_threat: string;
  page_predict_model_metrics: string;
  page_predict_no_seasonal: string;
  page_predict_no_trend: string;

  // Anomalies page
  page_anomaly_title: string;
  page_anomaly_search: string;
  page_anomaly_severity: string;
  page_anomaly_investigation: string;
  page_anomaly_detail: string;
  page_anomaly_offence_desc: string;
  page_anomaly_feature_explain: string;
  page_anomaly_empty: string;

  // Offenders page
  page_offender_title: string;
  page_offender_subtitle: string;
  page_offender_dossier_db: string;
  page_offender_search_alias: string;
  page_offender_cryptographic_audit: string;
  page_offender_clear_screen: string;
  page_offender_watermark: string;
  page_offender_no_dossier: string;

  // Victims page
  page_victim_title: string;
  page_victim_subtitle: string;
  page_victim_registry: string;
  page_victim_search: string;
  page_victimology_toggle: string;
  page_victim_back_dossiers: string;
  page_victim_statement: string;
  page_victim_linked_cases: string;

  // Officers page
  page_officer_title: string;
  page_officer_subtitle: string;
  page_officer_search: string;
  page_officer_add: string;
  page_officer_rank: string;
  page_officer_station: string;
  page_officer_district: string;
  page_officer_filter: string;

  // Network page
  page_network_title: string;
  page_network_subtitle: string;
  page_network_empty: string;
  page_network_focus_mode: string;
  page_network_exit: string;
  page_network_clear_filters: string;
  page_network_dataset_scope: string;
  page_network_no_relationships: string;

  // Sociological page
  page_socio_title: string;
  page_socio_subtitle: string;
  page_socio_loading: string;
  page_socio_refresh: string;
  page_socio_overview: string;
  page_socio_demographics: string;
  page_socio_geographic: string;
  page_socio_socioeconomic: string;
  page_socio_temporal: string;
  page_socio_offender_profile: string;

  // Strategic page
  page_strategic_title: string;
  page_strategic_subtitle: string;
  page_strategic_loading: string;
  page_strategic_refresh: string;
  page_strategic_daily_summary: string;
  page_strategic_command_overview: string;
  page_strategic_risk_districts: string;
  page_strategic_emerging_trends: string;
  page_strategic_deployment: string;
  page_strategic_interventions: string;
  page_strategic_top_networks: string;

  // Notifications page
  page_notif_title: string;
  page_notif_subtitle: string;
  page_notif_messages: string;
  page_notif_timeline: string;
  page_notif_activity: string;
  page_notif_health: string;
  page_notif_mark_all_read: string;
  page_notif_inform_station: string;

  // AI Chat page
  page_aichat_title: string;
  page_aichat_welcome: string;
  page_aichat_welcome_sub: string;
  page_aichat_temp_notice: string;
  page_aichat_new_chat: string;
  page_aichat_temp_chat: string;
  page_aichat_search_history: string;
  page_aichat_delete_all: string;
}

const en: TranslationSet = {
  // Navigation
  nav_dashboard: 'Dashboard',
  nav_command_center: 'Command Center',
  nav_intelligence: 'Intelligence',
  nav_intelligence_engine: 'Case Intelligence',
  nav_intelligence_fusion: 'Combined Intelligence',
  nav_fir: 'FIR',
  nav_hotspot: 'Hotspots',
  nav_network: 'Connections',
  nav_predictive: 'Risk Outlook',
  nav_anomaly: 'Unusual Activity',
  nav_crime_cases: 'Crime Cases',
  nav_investigation: 'Investigation',
  nav_notifications: 'Notifications',
  nav_offenders: 'Offenders',
  nav_criminals: 'Criminals',
  nav_victims: 'Victims',
  nav_officers: 'Officers',
  nav_evidence: 'Evidence',
  nav_reports: 'Reports',
  nav_sociological: 'Community Patterns',
  nav_strategic: 'Strategic',
  nav_ai_chat: 'AI Chat',
  nav_settings: 'Settings',
  nav_admin: 'Admin',
  nav_docs: 'Docs',
  nav_identity: 'Identity Matches',
  nav_face_recognition: 'Face ID',

  // Common actions
  action_search: 'Search',
  action_save: 'Save',
  action_cancel: 'Cancel',
  action_delete: 'Delete',
  action_edit: 'Edit',
  action_create: 'Create',
  action_export: 'Export',
  action_filter: 'Filter',
  action_back: 'Back',
  action_close: 'Close',
  action_confirm: 'Confirm',
  action_loading: 'Loading',
  action_refresh: 'Refresh',
  action_view: 'View',
  action_add: 'Add',

  // FIR page
  fir_title: 'First Information Reports',
  fir_subtitle: 'FIR Lifecycle Management',
  fir_directory: 'FIR Directory',
  fir_search_hint: 'Search FIRs by number, complainant, or sections...',
  fir_complainant: 'Complainant',
  fir_contact: 'Contact',
  fir_sections: 'Sections',
  fir_narrative: 'Narrative',
  fir_status_registered: 'Registered',
  fir_status_inquiry: 'Under Inquiry',
  fir_status_resolved: 'Resolved',
  fir_accused: 'Accused',
  fir_victims: 'Victims',
  fir_no_fir_selected: 'No FIR Selected',
  fir_select_hint: 'Select an FIR from the directory to view details',
  fir_create_new: 'Create New FIR',
  fir_edit: 'Edit FIR',
  fir_purge: 'Purge FIR',
  fir_build_intelligence: 'Build Intelligence',
  fir_case_link: 'Case Link',
  fir_officer: 'Assigned Officer',
  fir_unassigned: 'Unassigned',
  fir_risk_index: 'Risk Index',

  // Criminals page
  criminal_title: 'Criminal Registry',
  criminal_subtitle: 'Criminal Profiles & Intelligence',
  criminal_index: 'Criminal Index',
  criminal_search_hint: 'Search by name, alias, or gang...',
  criminal_status: 'Status',
  criminal_risk: 'Risk Score',
  criminal_aliases: 'Aliases',
  criminal_dob: 'Date of Birth',
  criminal_gender: 'Gender',
  criminal_gang: 'Gang Affiliation',
  criminal_address: 'Address',
  criminal_marks: 'Identifying Marks',
  criminal_mo: 'Modus Operandi',
  criminal_linked_cases: 'Linked Cases',
  criminal_network: 'Network',
  criminal_similar: 'Similar Offenders',
  criminal_open_dossier: 'Open Dossier',
  criminal_build_intelligence: 'Build Intelligence',

  // Investigation page
  investigation_title: 'Investigation Hub',
  investigation_subtitle: 'Unified Case Investigation Dashboard',
  investigation_cases: 'Active Cases',
  investigation_search: 'Search Cases',
  investigation_detail: 'Case Detail',
  investigation_timeline: 'Timeline',
  investigation_firs: 'FIRs',
  investigation_criminals: 'Criminals',
  investigation_evidence: 'Evidence',
  investigation_ai_recommendations: 'AI Recommendations',
  investigation_ai_chat: 'AI Chat',
  investigation_mo_patterns: 'MO Patterns',

  // Intelligence Engine
  intel_title: 'Intelligence Engine',
  intel_subtitle: 'Cross-Case Pattern Analysis & Crime DNA',
  intel_build: 'Build Intelligence',
  intel_building: 'Building Intelligence...',
  intel_summary: 'Summary',
  intel_connections: 'Connections',
  intel_common_threads: 'Common Threads',
  intel_case_comparison: 'Case Comparison',
  intel_crime_dna: 'Crime DNA',
  intel_investigation_leads: 'Investigation Leads',
  intel_timeline: 'Timeline',
  intel_network: 'Network',
  intel_pattern_breaks: 'Pattern Breaks',
  intel_anomalies: 'Anomalies',
  intel_evidence_trail: 'Evidence Trail',
  intel_confidence: 'Confidence',
  intel_confirmed: 'Confirmed',
  intel_probable: 'Probable',
  intel_possible: 'Possible',
  intel_insufficient_data: 'Insufficient Data',
  intel_explainability: 'Explainability',
  intel_supporting_records: 'Supporting Records',
  intel_start_hint: 'Select entities to begin cross-case intelligence analysis',
  intel_select_entity: 'Select Entity',
  intel_no_connections: 'No connections found',
  intel_no_threads: 'No common threads identified',
  intel_no_leads: 'No investigation leads generated',
  intel_pattern_baseline: 'Pattern Baseline',
  intel_pattern_deviation: 'Pattern Deviation',
  intel_new_analysis: 'New Analysis',
  intel_search_placeholder: 'Search FIR number, case number, name or alias…',
  intel_capabilities: 'Engine Capabilities',
  intel_recent_analyses: 'Recent Analyses',
  intel_no_history: 'No analyses yet',
  intel_no_history_hint: 'Build your first intelligence report by searching above.',
  intel_loading_history: 'Loading history…',
  intel_searching: 'Searching registry…',
  intel_no_results: 'No entities found',
  intel_no_results_hint: 'Try a FIR number, case number, criminal name/alias or victim name. Adjust the type filter.',
  intel_entities: 'Entities',
  intel_remove_history: 'Remove from history',
  intel_start_any: 'Start from any FIR, case, criminal or victim to generate a unified intelligence report.',

  // Dashboard
  dashboard_title: 'Command Center',
  dashboard_subtitle: 'Karnataka State Police Intelligence Overview',
  dashboard_total_cases: 'Total Cases',
  dashboard_active_firs: 'Active FIRs',
  dashboard_open_cases: 'Open Cases',
  dashboard_risk_alerts: 'Risk Alerts',

  // Common UI
  ui_no_data: 'No Data',
  ui_error: 'Error',
  ui_retry: 'Retry',
  ui_empty_state: 'No data available',
  ui_confirm_delete: 'Are you sure you want to delete this?',
  ui_filter_all: 'All',
  ui_status_open: 'Open',
  ui_status_closed: 'Closed',
  ui_status_active: 'Active',
  ui_priority_critical: 'Critical',
  ui_priority_high: 'High',
  ui_priority_medium: 'Medium',
  ui_priority_low: 'Low',

  // Settings
  settings_title: 'Settings',
  settings_profile: 'Profile',
  settings_system: 'System',
  settings_help: 'Help',
  settings_language: 'Language',
  settings_language_preference: 'Language Preference',
  settings_language_hint: 'Choose your preferred language for the interface',
  settings_english: 'English',
  settings_kannada: 'Kannada',
  settings_kanglish: 'Kanglish',
  settings_ai_language_note: 'AI chat language is independent of UI language',

  // Evidence
  evidence_title: 'Evidence Management',
  evidence_chain: 'Chain of Custody',
  evidence_upload: 'Upload Evidence',
  evidence_type: 'Evidence Type',
  evidence_no_data: 'No Evidence Available',
  evidence_search_hint: 'Search evidence by type, case, or description...',
  evidence_status: 'Status',
  evidence_officer: 'Assigned Officer',
  evidence_upload_date: 'Upload Date',
  evidence_hash: 'File Hash',

  // Crime Cases
  cc_title: 'SAKSHA Crime Intelligence Cases',
  cc_subtitle: 'OPERATOR SYSTEM PROFILE CLEARANCE LEVEL',
  cc_create: 'Create Crime Case',
  cc_search_hint: 'Search by case number, description...',
  cc_all_status: 'ALL STATUS LEVELS',
  cc_all_categories: 'ALL CATEGORIES',
  cc_all_districts: 'ALL DISTRICTS',
  cc_all_priorities: 'ALL PRIORITIES',
  cc_case_details: 'Case Details',
  cc_occurred_at: 'Occurred At',
  cc_status: 'Status',
  cc_priority: 'Priority',
  cc_progress: 'Progress Tracker',
  cc_actions: 'Actions',
  cc_view: 'View Case Dossier',
  cc_edit: 'Edit Configuration',
  cc_purge: 'Purge Case Record',
  cc_no_cases: 'NO ACTIVE CRIME CASES ENROLLED MATCHING CURRENT TELEMETRY FILTERS',
  cc_no_description: 'No description provided',
  cc_reset: 'Reset',
  cc_back: 'Back to Cases',
  cc_description: 'Description',
  cc_category: 'Category',
  cc_district: 'District',
  cc_assigned_officer: 'Assigned Officer',
  cc_investigation_notes: 'Investigation Notes',
  cc_add_note: 'Add Note',
  cc_linked_firs: 'Linked FIRs',
  cc_link_fir: 'Link FIR',
  cc_ai_insights: 'AI Case Insights',

  // Reports
  reports_title: 'Reports',
  reports_generate: 'Generate Report',
  reports_export: 'Export Report',

  // Notifications
  notifications_title: 'Notifications',
  notifications_unread: 'Unread',
  notifications_mark_read: 'Mark as Read',

  // Login
  login_title: 'Saksha',
  login_subtitle: 'Crime Intelligence & Analytical Platform',
  login_badge_hint: 'Enter your Badge ID to sign in',
  login_face_auth: 'Face Authentication',

  // Footer
  footer_version: 'v2.3.2',
  footer_stamp: 'CLASSIFIED TELEMETRY DATABASES LOCK',

  // Hotspots page
  page_hotspot_title: 'HOTSPOT ANALYSIS',
  page_hotspot_subtitle: 'AI CRIME PATTERN ANALYSIS • EMBEDDED TERRAIN INTELLIGENCE',
  page_hotspot_loading: 'Loading hotspots...',
  page_hotspot_vector_map: 'HOTSPOT VECTOR MAP',
  page_hotspot_matrix: 'CRIME CATEGORY × DAY-OF-WEEK HEAT MATRIX',
  page_hotspot_export: 'Export Hotspot Data',
  page_hotspot_emerging_alerts: 'EMERGING HOTSPOT ALERTS',
  page_hotspot_red_zone: 'RED ZONE',

  // Predictions page
  page_predict_title: 'AI Crime Predictive Intelligence',
  page_predict_loading: 'Loading predictions...',
  page_predict_seasonal: 'Seasonal Crime Pattern',
  page_predict_emerging: 'Emerging Threat Assessment',
  page_predict_threat: 'THREAT LEVEL:',
  page_predict_model_metrics: 'PREDICTIVE MODEL METRICS',
  page_predict_no_seasonal: 'No seasonal data available for the current period.',
  page_predict_no_trend: 'Insufficient data to determine trend.',

  // Anomalies page
  page_anomaly_title: 'ANOMALY DETECTION CENTER',
  page_anomaly_search: 'Search anomalies by case ID...',
  page_anomaly_severity: 'Severity',
  page_anomaly_investigation: 'Requires Investigation',
  page_anomaly_detail: 'ANOMALY DETAIL',
  page_anomaly_offence_desc: 'OFFENCE DESCRIPTION',
  page_anomaly_feature_explain: 'FEATURE CONTRIBUTION TO ANOMALY SCORE',
  page_anomaly_empty: 'No anomalies match the current filters.',

  // Offenders page
  page_offender_title: 'OFFENDER DOSSIER DATABASE',
  page_offender_subtitle: 'REPEAT OFFENDER REGISTRY & SYSTEM SECURITY LOGS',
  page_offender_dossier_db: 'Offender Dossier Database',
  page_offender_search_alias: 'Search by Alias, Crime Type, or Case Link...',
  page_offender_cryptographic_audit: 'SYSTEM SECURITY & CRYPTOGRAPHIC AUDIT LOG',
  page_offender_clear_screen: 'Clear Screen',
  page_offender_watermark: 'CLASSIFIED CRIMINAL INTELLIGENCE DOSSIER',
  page_offender_no_dossier: 'Select an offender dossier to view detailed intelligence.',

  // Victims page
  page_victim_title: 'VICTIM DOSSIER DATABASE',
  page_victim_subtitle: 'WITNESS PROTECTION REGISTRY',
  page_victim_registry: 'Victim & Witness Registry',
  page_victim_search: 'Search by Name, Occupation, or Victim Status...',
  page_victimology_toggle: 'Victimology Analytics',
  page_victim_back_dossiers: 'Back to Victim Dossiers',
  page_victim_statement: 'VICTIM STATEMENT',
  page_victim_linked_cases: 'LINKED CRIME CASES',

  // Officers page
  page_officer_title: 'OFFICER MANAGEMENT',
  page_officer_subtitle: 'FORCE PERSONNEL DIRECTORY',
  page_officer_search: 'Search by Name, Badge ID, or District...',
  page_officer_add: 'Add Officer',
  page_officer_rank: 'Rank',
  page_officer_station: 'Station',
  page_officer_district: 'District',
  page_officer_filter: 'Filter officers by rank or district',

  // Network page
  page_network_title: 'Criminal Network Intelligence',
  page_network_subtitle: 'Graph-Link Analysis Engine — Neo4j Augmented',
  page_network_empty: 'No relationships found for the selected scope.',
  page_network_focus_mode: 'Focus Mode',
  page_network_exit: 'Exit',
  page_network_clear_filters: 'Clear Filters',
  page_network_dataset_scope: 'Dataset Scope',
  page_network_no_relationships: 'No relationships detected for the selected criteria.',

  // Sociological page
  page_socio_title: 'Sociological Intelligence',
  page_socio_subtitle: 'Census 2011 & Socio-Economic Indicators for Karnataka Districts',
  page_socio_loading: 'Loading sociological data...',
  page_socio_refresh: 'Refresh Data',
  page_socio_overview: 'Overview',
  page_socio_demographics: 'Demographics',
  page_socio_geographic: 'Geographic',
  page_socio_socioeconomic: 'Socioeconomic',
  page_socio_temporal: 'Temporal',
  page_socio_offender_profile: 'Offender Profile',

  // Strategic page
  page_strategic_title: 'STRATEGIC COMMAND',
  page_strategic_subtitle: 'DISTRICT HEATMAP • RESOURCE ALLOCATION • INTERVENTION INTELLIGENCE',
  page_strategic_loading: 'Generating strategic intelligence...',
  page_strategic_refresh: 'Refresh Intelligence',
  page_strategic_daily_summary: 'DAILY INTELLIGENCE SUMMARY',
  page_strategic_command_overview: 'STRATEGIC COMMAND OVERVIEW',
  page_strategic_risk_districts: 'HIGH-RISK DISTRICTS',
  page_strategic_emerging_trends: 'EMERGING CRIME TRENDS',
  page_strategic_deployment: 'RESOURCE DEPLOYMENT SUGGESTIONS',
  page_strategic_interventions: 'INTERVENTION EFFECTIVENESS',
  page_strategic_top_networks: 'TOP ACTIVE CRIMINAL NETWORKS',

  // Notifications page
  page_notif_title: 'NOTIFICATION CENTER',
  page_notif_subtitle: 'REAL-TIME INTELLIGENCE FEED & ALERT MANAGEMENT',
  page_notif_messages: 'MESSAGES',
  page_notif_timeline: 'TIMELINE',
  page_notif_activity: 'ACTIVITY',
  page_notif_health: 'HEALTH',
  page_notif_mark_all_read: 'Mark All Read',
  page_notif_inform_station: 'Inform Station HO',

  // AI Chat page
  page_aichat_title: 'Saksha AI Analyst',
  page_aichat_welcome: 'Hello, Officer.',
  page_aichat_welcome_sub: 'Your multi-turn stateful intelligence analyst is initialized. I operate under the INDIGO operational protocol, providing deep, contextual answers. How can I assist your investigation today?',
  page_aichat_temp_notice: 'Persistent memory is currently in maintenance mode. This session is temporary. For critical intelligence, save your findings externally.',
  page_aichat_new_chat: 'New Chat',
  page_aichat_temp_chat: 'TEMP CHAT',
  page_aichat_search_history: 'Search history...',
  page_aichat_delete_all: 'Delete All History',
};

const kn: TranslationSet = {
  // Navigation
  nav_dashboard: 'ಡ್ಯಾಶ್\u200Cಬೋರ್ಡ್',
  nav_command_center: 'ಆದೇಶ ಕೇಂದ್ರ',
  nav_intelligence: 'ಗುಪ್ತಚರ',
  nav_intelligence_engine: 'ಪ್ರಕರಣ ಗುಪ್ತಚರ',
  nav_intelligence_fusion: 'ಒಗ್ಗೂಡಿದ ಗುಪ್ತಚರ',
  nav_fir: 'ಎಫ್\u200Cಐಆರ್',
  nav_hotspot: 'ಹಾಟ್\u200Cಸ್\u200Cಪಾಟ್\u200Cಗಳು',
  nav_network: 'ಸಂಪರ್ಕಗಳು',
  nav_predictive: 'ಅಪಾಯದ ನೋಟ',
  nav_anomaly: 'ಅಸಾಮಾನ್ಯ ಚಟುವಟಿಕೆ',
  nav_crime_cases: 'ಅಪರಾಧ ಪ್ರಕರಣಗಳು',
  nav_investigation: 'ತನಿಖೆ',
  nav_notifications: 'ಅಧಿಸೂಚನೆಗಳು',
  nav_offenders: 'ಅಪರಾಧಿಗಳು',
  nav_criminals: 'ಅಪರಾಧಿಗಳು',
  nav_victims: 'ಬಾಧಿತರು',
  nav_officers: 'ಅಧಿಕಾರಿಗಳು',
  nav_evidence: 'ಸಾಕ್ಷ್ಯ',
  nav_reports: 'ವರದಿಗಳು',
  nav_sociological: 'ಸಮುದಾಯ ಮಾದರಿಗಳು',
  nav_strategic: 'ತಂತ್ರಾತ್ಮಕ',
  nav_ai_chat: 'AI ಚಾಟ್',
  nav_settings: 'ಸೆಟ್\u200Cಟಿಂಗ್\u200Cಗಳು',
  nav_admin: 'ನಿರ್ವಾಹಕ',
  nav_docs: 'ದಸ್ತಾವೇಜುಗಳು',
  nav_identity: 'ಗುರುತಿನ ಹೊಂದಾಣಿಕೆ',
  nav_face_recognition: 'ಮುಖ ಗುರುತಿಸುವಿಕೆ',

  // Common actions
  action_search: 'ಹುಡುಕು',
  action_save: 'ಉಳಿಸಿ',
  action_cancel: 'ರದ್ದುಮಾಡಿ',
  action_delete: 'ಅಳಿಸಿ',
  action_edit: 'ತಿದ್ದುಪಡಿ',
  action_create: 'ರಚಿಸಿ',
  action_export: 'ರಫ್ತು',
  action_filter: 'ಫಿಲ್\u200Cಟರ್',
  action_back: 'ಹಿಂದೆ',
  action_close: 'ಮುಚ್ಚಿ',
  action_confirm: 'ಖಚಿತಪಡಿಸಿ',
  action_loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ',
  action_refresh: 'ರಿಫ್\u200Cರೆಶ್',
  action_view: 'ವೀಕ್ಷಿಸಿ',
  action_add: 'ಸೇರಿಸಿ',

  // FIR page
  fir_title: 'ಪ್ರಥಮ ಮಾಹಿತಿ ವರದಿಗಳು',
  fir_subtitle: 'ಎಫ್\u200Cಐಆರ್ ಜೀವನಚಕ್ರ ನಿರ್ವಹಣೆ',
  fir_directory: 'ಎಫ್\u200Cಐಆರ್ ಡೈರೆಕ್ಟರಿ',
  fir_search_hint: 'ಸಂಖ್ಯೆ, ದೂರುದಾರ ಅಥವಾ ಸೆಕ್ಷನ್\u200Cಗಳಿಂದ ಹುಡುಕಿ...',
  fir_complainant: 'ದೂರುದಾರ',
  fir_contact: 'ಸಂಪರ್ಕ',
  fir_sections: 'ಸೆಕ್ಷನ್\u200Cಗಳು',
  fir_narrative: 'ಕಥಾವಸ್ತು',
  fir_status_registered: 'ನೋಂದಾಯಿಸಲಾಗಿದೆ',
  fir_status_inquiry: 'ತನಿಖೆಯಲ್ಲಿದೆ',
  fir_status_resolved: 'ಪರಿಹರಿಸಲಾಗಿದೆ',
  fir_accused: 'ಆರೋಪಿ',
  fir_victims: 'ಬಾಧಿತರು',
  fir_no_fir_selected: 'ಎಫ್\u200Cಐಆರ್ ಆಯ್ಕೆಮಾಡಿಲ್ಲ',
  fir_select_hint: 'ವಿವರಗಳನ್ನು ನೋಡಲು ಡೈರೆಕ್ಟರಿಯಿಂದ ಎಫ್\u200Cಐಆರ್ ಆಯ್ಕೆಮಾಡಿ',
  fir_create_new: 'ಹೊಸ ಎಫ್\u200Cಐಆರ್ ರಚಿಸಿ',
  fir_edit: 'ಎಫ್\u200Cಐಆರ್ ತಿದ್ದುಪಡಿ',
  fir_purge: 'ಎಫ್\u200Cಐಆರ್ ಅಳಿಸಿ',
  fir_build_intelligence: 'ಗುಪ್ತಚರ ನಿರ್ಮಿಸಿ',
  fir_case_link: 'ಪ್ರಕರಣ ಲಿಂಕ್',
  fir_officer: 'ನಿಯೋಜಿತ ಅಧಿಕಾರಿ',
  fir_unassigned: 'ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ',
  fir_risk_index: 'ಅಪಾಯ ಸೂಚ್ಯಾಂಕ',

  // Criminals page
  criminal_title: 'ಅಪರಾಧಿ ನೋಂದಣಿ',
  criminal_subtitle: 'ಅಪರಾಧಿ ಪ್ರೊಫೈಲ್\u200Cಗಳು ಮತ್ತು ಗುಪ್ತಚರ',
  criminal_index: 'ಅಪರಾಧಿ ಸೂಚ್ಯಾಂಕ',
  criminal_search_hint: 'ಹೆಸರು, ಅಡ್ಡಹೆಸರು ಅಥವಾ ಗ್ಯಾಂಗ್\u200Cನಿಂದ ಹುಡುಕಿ...',
  criminal_status: 'ಸ್ಥಿತಿ',
  criminal_risk: 'ಅಪಾಯ ಸ್ಕೋರ್',
  criminal_aliases: 'ಅಡ್ಡಹೆಸರುಗಳು',
  criminal_dob: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ',
  criminal_gender: 'ಲಿಂಗ',
  criminal_gang: 'ಗ್ಯಾಂಗ್ ಸೇರ್ಪಡೆ',
  criminal_address: 'ವಿಳಾಸ',
  criminal_marks: 'ಗುರುತಿನ ಗುರುತುಗಳು',
  criminal_mo: 'ಕಾರ್ಯವಿಧಾನ',
  criminal_linked_cases: 'ಸಂಬಂಧಿತ ಪ್ರಕರಣಗಳು',
  criminal_network: 'ಜಾಲ',
  criminal_similar: 'ಹೋಲುವ ಅಪರಾಧಿಗಳು',
  criminal_open_dossier: 'ಡೋಸಿಯರ್ ತೆರೆಯಿರಿ',
  criminal_build_intelligence: 'ಗುಪ್ತಚರ ನಿರ್ಮಿಸಿ',

  // Investigation page
  investigation_title: 'ತನಿಖೆ ಕೇಂದ್ರ',
  investigation_subtitle: 'ಏಕೀಕೃತ ಪ್ರಕರಣ ತನಿಖೆ ಡ್ಯಾಶ್\u200Cಬೋರ್ಡ್',
  investigation_cases: 'ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು',
  investigation_search: 'ಪ್ರಕರಣಗಳನ್ನು ಹುಡುಕಿ',
  investigation_detail: 'ಪ್ರಕರಣ ವಿವರ',
  investigation_timeline: 'ಕಾಲಾವಧಿ',
  investigation_firs: 'ಎಫ್\u200Cಐಆರ್\u200Cಗಳು',
  investigation_criminals: 'ಅಪರಾಧಿಗಳು',
  investigation_evidence: 'ಸಾಕ್ಷ್ಯ',
  investigation_ai_recommendations: 'AI ಶಿಫಾರಸುಗಳು',
  investigation_ai_chat: 'AI ಚಾಟ್',
  investigation_mo_patterns: 'MO ಮಾದರಿಗಳು',

  // Intelligence Engine
  intel_title: 'ಗುಪ್ತಚರ ಎಂಜಿನ್',
  intel_subtitle: 'ಪ್ರಕರಣಾಂತರ ಮಾದರಿ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಅಪರಾಧ DNA',
  intel_build: 'ಗುಪ್ತಚರ ನಿರ್ಮಿಸಿ',
  intel_building: 'ಗುಪ್ತಚರ ನಿರ್ಮಿಸಲಾಗುತ್ತಿದೆ...',
  intel_summary: 'ಸಾರಾಂಶ',
  intel_connections: 'ಸಂಪರ್ಕಗಳು',
  intel_common_threads: 'ಸಾಮಾನ್ಯ ಧಾಗೆಗಳು',
  intel_case_comparison: 'ಪ್ರಕರಣ ಹೋಲಿಕೆ',
  intel_crime_dna: 'ಅಪರಾಧ DNA',
  intel_investigation_leads: 'ತನಿಖೆ ಸುಳಿವುಗಳು',
  intel_timeline: 'ಕಾಲಾವಧಿ',
  intel_network: 'ಜಾಲ',
  intel_pattern_breaks: 'ಮಾದರಿ ಮುರಿತಗಳು',
  intel_anomalies: 'ಅಸಾಮಾನ್ಯತೆಗಳು',
  intel_evidence_trail: 'ಸಾಕ್ಷ್ಯ ಹಾದಿ',
  intel_confidence: 'ವಿಶ್ವಾಸಾರ್ಹತೆ',
  intel_confirmed: 'ಖಚಿತ',
  intel_probable: 'ಸಂಭಾವ್ಯ',
  intel_possible: 'ಸಾಧ್ಯ',
  intel_insufficient_data: 'ಅಪೂರ್ಣ ಡೇಟಾ',
  intel_explainability: 'ವಿವರಣೆಯುಕ್ತತೆ',
  intel_supporting_records: 'ಬೆಂಬಲ ದಾಖಲೆಗಳು',
  intel_start_hint: 'ಪ್ರಕರಣಾಂತರ ಗುಪ್ತಚರ ವಿಶ್ಲೇಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಲು ಘಟಕಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  intel_select_entity: 'ಘಟಕ ಆಯ್ಕೆಮಾಡಿ',
  intel_no_connections: 'ಯಾವುದೇ ಸಂಪರ್ಕಗಳು ಕಂಡುಬಂದಿಲ್ಲ',
  intel_no_threads: 'ಯಾವುದೇ ಸಾಮಾನ್ಯ ಧಾಗೆಗಳು ಗುರುತಿಸಲಾಗಿಲ್ಲ',
  intel_no_leads: 'ಯಾವುದೇ ತನಿಖೆ ಸುಳಿವುಗಳು ಉತ್ಪಾದಿಸಲಾಗಿಲ್ಲ',
  intel_pattern_baseline: 'ಮಾದರಿ ಆಧಾರರೇಖೆ',
  intel_pattern_deviation: 'ಮಾದರಿ ವಿಚಲನ',
  intel_new_analysis: 'ಹೊಸ ವಿಶ್ಲೇಷಣೆ',
  intel_search_placeholder: 'ಎಫ್\u200Cಐಆರ್ ಸಂಖ್ಯೆ, ಪ್ರಕರಣ ಸಂಖ್ಯೆ, ಹೆಸರು ಅಥವಾ ಅಡ್ಡಹೆಸರಿನಿಂದ ಹುಡುಕಿ…',
  intel_capabilities: 'ಎಂಜಿನ್ ಸಾಮರ್ಥ್ಯಗಳು',
  intel_recent_analyses: 'ಇತ್ತೀಚಿನ ವಿಶ್ಲೇಷಣೆಗಳು',
  intel_no_history: 'ವಿಶ್ಲೇಷಣೆಗಳು ಇನ್ನೂ ಇಲ್ಲ',
  intel_no_history_hint: 'ಮೇಲೆ ಹುಡುಕುವ ಮೂಲಕ ನಿಮ್ಮ ಮೊದಲ ಗುಪ್ತಚರ ವರದಿಯನ್ನು ನಿರ್ಮಿಸಿ.',
  intel_loading_history: 'ಇತಿಹಾಸ ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
  intel_searching: 'ನೋಂದಣಿ ಹುಡುಕಲಾಗುತ್ತಿದೆ…',
  intel_no_results: 'ಯಾವುದೇ ಘಟಕಗಳು ಕಂಡುಬಂದಿಲ್ಲ',
  intel_no_results_hint: 'ಎಫ್\u200Cಐಆರ್ ಸಂಖ್ಯೆ, ಪ್ರಕರಣ ಸಂಖ್ಯೆ, ಅಪರಾಧಿ ಹೆಸರು/ಅಡ್ಡಹೆಸರು ಅಥವಾ ಬಾಧಿತರ ಹೆಸರು ಪ್ರಯತ್ನಿಸಿ. ಪ್ರಕಾರ ಫಿಲ್ಟರ್ ಹೊಂದಿಸಿ.',
  intel_entities: 'ಘಟಕಗಳು',
  intel_remove_history: 'ಇತಿಹಾಸದಿಂದ ತೆಗೆದುಹಾಕಿ',
  intel_start_any: 'ಯಾವುದೇ ಎಫ್\u200Cಐಆರ್, ಪ್ರಕರಣ, ಅಪರಾಧಿ ಅಥವಾ ಬಾಧಿತರಿಂದ ಏಕೀಕೃತ ಗುಪ್ತಚರ ವರದಿಯನ್ನು ರಚಿಸಿ.',

  // Dashboard
  dashboard_title: 'ಆದೇಶ ಕೇಂದ್ರ',
  dashboard_subtitle: 'ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ ಗುಪ್ತಚರ ಅವಲೋಕನ',
  dashboard_total_cases: 'ಒಟ್ಟು ಪ್ರಕರಣಗಳು',
  dashboard_active_firs: 'ಸಕ್ರಿಯ ಎಫ್\u200Cಐಆರ್\u200Cಗಳು',
  dashboard_open_cases: 'ತೆರೆದ ಪ್ರಕರಣಗಳು',
  dashboard_risk_alerts: 'ಅಪಾಯ ಎಚ್ಚರಿಕೆಗಳು',

  // Common UI
  ui_no_data: 'ಡೇಟಾ ಇಲ್ಲ',
  ui_error: 'ದೋಷ',
  ui_retry: 'ಮರುಪ್ರಯತ್ನ',
  ui_empty_state: 'ಯಾವುದೇ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ',
  ui_confirm_delete: 'ನೀವು ಖಚಿತವಾಗಿ ಇದನ್ನು ಅಳಿಸಲು ಬಯಸುವಿರಾ?',
  ui_filter_all: 'ಎಲ್ಲಾ',
  ui_status_open: 'ತೆರೆದ',
  ui_status_closed: 'ಮುಚ್ಚಲಾಗಿದೆ',
  ui_status_active: 'ಸಕ್ರಿಯ',
  ui_priority_critical: 'ಗಂಭೀರ',
  ui_priority_high: 'ಹೆಚ್ಚು',
  ui_priority_medium: 'ಮಧ್ಯಮ',
  ui_priority_low: 'ಕಡಿಮೆ',

  // Settings
  settings_title: 'ಸೆಟ್\u200Cಟಿಂಗ್\u200Cಗಳು',
  settings_profile: 'ಪ್ರೊಫೈಲ್',
  settings_system: 'ಸಿಸ್ಟಮ್',
  settings_help: 'ಸಹಾಯ',
  settings_language: 'ಭಾಷೆ',
  settings_language_preference: 'ಭಾಷೆ ಆದ್ಯತೆ',
  settings_language_hint: 'ಇಂಟರ್ಫೇಸ್\u200Cಗಾಗಿ ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  settings_english: 'ಇಂಗ್ಲಿಷ್',
  settings_kannada: 'ಕನ್ನಡ',
  settings_kanglish: 'ಕ್ಯಾಂಗ್ಲಿಷ್',
  settings_ai_language_note: 'AI ಚಾಟ್ ಭಾಷೆ UI ಭಾಷೆಯಿಂದ ಸ್ವತಂತ್ರ',

  // Evidence
  evidence_title: 'ಸಾಕ್ಷ್ಯ ನಿರ್ವಹಣೆ',
  evidence_chain: 'ಕಸ್ಟಡಿ ಸರಪಳಿ',
  evidence_upload: 'ಸಾಕ್ಷ್ಯ ಅಪ್ಲೋಡ್',
  evidence_type: 'ಸಾಕ್ಷ್ಯ ಪ್ರಕಾರ',
  evidence_no_data: 'ಸಾಕ್ಷ್ಯ ಲಭ್ಯವಿಲ್ಲ',
  evidence_search_hint: 'ಪ್ರಕಾರ, ಪ್ರಕರಣ ಅಥವಾ ವಿವರಣೆಯಿಂದ ಸಾಕ್ಷ್ಯ ಹುಡುಕಿ...',
  evidence_status: 'ಸ್ಥಿತಿ',
  evidence_officer: 'ನಿಯೋಜಿತ ಅಧಿಕಾರಿ',
  evidence_upload_date: 'ಅಪ್ಲೋಡ್ ದಿನಾಂಕ',
  evidence_hash: 'ಫೈಲ್ ಹ್ಯಾಶ್',

  // Crime Cases
  cc_title: 'ಸಕ್ಷ ಅಪರಾಧ ಗುಪ್ತಚರ ಪ್ರಕರಣಗಳು',
  cc_subtitle: 'ಆಪರೇಟರ್ ಸಿಸ್ಟಮ್ ಪ್ರೊಫೈಲ್ ಕ್ಲಿಯರೆನ್ಸ್ ಮಟ್ಟ',
  cc_create: 'ಅಪರಾಧ ಪ್ರಕರಣ ರಚಿಸಿ',
  cc_search_hint: 'ಪ್ರಕರಣ ಸಂಖ್ಯೆ, ವಿವರಣೆಯಿಂದ ಹುಡುಕಿ...',
  cc_all_status: 'ಎಲ್ಲಾ ಸ್ಥಿತಿ ಮಟ್ಟಗಳು',
  cc_all_categories: 'ಎಲ್ಲಾ ವರ್ಗಗಳು',
  cc_all_districts: 'ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು',
  cc_all_priorities: 'ಎಲ್ಲಾ ಆದ್ಯತೆಗಳು',
  cc_case_details: 'ಪ್ರಕರಣ ವಿವರಗಳು',
  cc_occurred_at: 'ಸಂಭವಿಸಿದ ಸಮಯ',
  cc_status: 'ಸ್ಥಿತಿ',
  cc_priority: 'ಆದ್ಯತೆ',
  cc_progress: 'ಪ್ರಗತಿ ಟ್ರ್ಯಾಕರ್',
  cc_actions: 'ಕ್ರಿಯೆಗಳು',
  cc_view: 'ಪ್ರಕರಣ ಡೋಸಿಯರ್ ನೋಡಿ',
  cc_edit: 'ಸಂರಚನೆ ತಿದ್ದುಪಡಿ',
  cc_purge: 'ಪ್ರಕರಣ ದಾಖಲೆ ಅಳಿಸಿ',
  cc_no_cases: 'ಪ್ರಸ್ತುತ ಟೆಲಿಮೆಟ್ರಿ ಫಿಲ್ಟರ್‌ಗಳಿಗೆ ಹೊಂದಿಕೆಯಾಗುವ ಸಕ್ರಿಯ ಅಪರಾಧ ಪ್ರಕರಣಗಳು ಇಲ್ಲ',
  cc_no_description: 'ವಿವರಣೆ ನೀಡಲಾಗಿಲ್ಲ',
  cc_reset: 'ಮರುಹೊಂದಿಸಿ',
  cc_back: 'ಪ್ರಕರಣಗಳಿಗೆ ಹಿಂದೆ',
  cc_description: 'ವಿವರಣೆ',
  cc_category: 'ವರ್ಗ',
  cc_district: 'ಜಿಲ್ಲೆ',
  cc_assigned_officer: 'ನಿಯೋಜಿತ ಅಧಿಕಾರಿ',
  cc_investigation_notes: 'ತನಿಖೆ ಟಿಪ್ಪಣಿಗಳು',
  cc_add_note: 'ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ',
  cc_linked_firs: 'ಸಂಬಂಧಿತ ಎಫ್\u200Cಐಆರ್\u200Cಗಳು',
  cc_link_fir: 'ಎಫ್\u200Cಐಆರ್ ಲಿಂಕ್ ಮಾಡಿ',
  cc_ai_insights: 'AI ಪ್ರಕರಣ ಒಳನೋಟಗಳು',

  // Reports
  reports_title: 'ವರದಿಗಳು',
  reports_generate: 'ವರದಿ ರಚಿಸಿ',
  reports_export: 'ವರದಿ ರಫ್ತು',

  // Notifications
  notifications_title: 'ಅಧಿಸೂಚನೆಗಳು',
  notifications_unread: 'ಓದಿಲ್ಲ',
  notifications_mark_read: 'ಓದಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ',

  // Login
  login_title: 'ಸಕ್ಷ',
  login_subtitle: 'ಅಪರಾಧ ಗುಪ್ತಚರ ಮತ್ತು ವಿಶ್ಲೇಷಣಾ ವೇದಿಕೆ',
  login_badge_hint: 'ಸೈನ್ ಇನ್ ಮಾಡಲು ನಿಮ್ಮ ಬ್ಯಾಜ್ ಐಡಿ ನಮೂದಿಸಿ',
  login_face_auth: 'ಮುಖ ದೃಢೀಕರಣ',

  // Footer
  footer_version: 'v2.3.2',
  footer_stamp: 'ವರ್ಗೀಕೃತ ಟೆಲಿಮೆಟ್ರಿ ಡೇಟಾಬೇಸ್\u200Cಗಳ ಲಾಕ್',

  // Hotspots page
  page_hotspot_title: 'ಹಾಟ್\u200Cಸ್\u200Cಪಾಟ್ ವಿಶ್ಲೇಷಣೆ',
  page_hotspot_subtitle: 'AI ಅಪರಾಧ ಮಾದರಿ ವಿಶ್ಲೇಷಣೆ • ಎಂಬೆಡೆಡ್ ಭೂಮಿ ಗುಪ್ತಚರ',
  page_hotspot_loading: 'ಹಾಟ್\u200Cಸ್\u200Cಪಾಟ್\u200Cಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...',
  page_hotspot_vector_map: 'ಹಾಟ್\u200Cಸ್\u200Cಪಾಟ್ ವೆಕ್ಟರ್ ನಕ್ಷೆ',
  page_hotspot_matrix: 'ಅಪರಾಧ ವರ್ಗ × ವಾರದ ದಿನ ಹೀಟ್ ಮ್ಯಾಟ್ರಿಕ್ಸ್',
  page_hotspot_export: 'ಹಾಟ್\u200Cಸ್\u200Cಪಾಟ್ ಡೇಟಾ ರಫ್ತು',
  page_hotspot_emerging_alerts: 'ಹೊರಹೊಮ್ಮುತ್ತಿರುವ ಹಾಟ್\u200Cಸ್\u200Cಪಾಟ್ ಎಚ್ಚರಿಕೆಗಳು',
  page_hotspot_red_zone: 'ಕೆಂಪು ವಲಯ',

  // Predictions page
  page_predict_title: 'AI ಅಪರಾಧ ಮುನ್ಸೂಚನಾ ಗುಪ್ತಚರ',
  page_predict_loading: 'ಮುನ್ಸೂಚನೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...',
  page_predict_seasonal: 'ಋತುಮಾನದ ಅಪರಾಧ ಮಾದರಿ',
  page_predict_emerging: 'ಹೊರಹೊಮ್ಮುತ್ತಿರುವ ಬೆದರಿಕೆ ಮೌಲ್ಯಮಾಪನ',
  page_predict_threat: 'ಬೆದರಿಕೆ ಮಟ್ಟ:',
  page_predict_model_metrics: 'ಮುನ್ಸೂಚನಾ ಮಾದರಿ ಮಾಪನಗಳು',
  page_predict_no_seasonal: 'ಪ್ರಸ್ತುತ ಅವಧಿಗೆ ಋತುಮಾನದ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ.',
  page_predict_no_trend: 'ಪ್ರವೃತ್ತಿಯನ್ನು ನಿರ್ಧರಿಸಲು ಅಪೂರ್ಣ ಡೇಟಾ.',

  // Anomalies page
  page_anomaly_title: 'ಅಸಾಮಾನ್ಯತೆ ಪತ್ತೆ ಕೇಂದ್ರ',
  page_anomaly_search: 'ಪ್ರಕರಣ ID ಯಿಂದ ಅಸಾಮಾನ್ಯತೆಗಳನ್ನು ಹುಡುಕಿ...',
  page_anomaly_severity: 'ತೀವ್ರತೆ',
  page_anomaly_investigation: 'ತನಿಖೆ ಅಗತ್ಯವಿದೆ',
  page_anomaly_detail: 'ಅಸಾಮಾನ್ಯತೆ ವಿವರ',
  page_anomaly_offence_desc: 'ಅಪರಾಧ ವಿವರಣೆ',
  page_anomaly_feature_explain: 'ಅಸಾಮಾನ್ಯತೆ ಸ್ಕೋರ್\u200Cಗೆ ವೈಶಿಷ್ಟ್ಯ ಕೊಡುಗೆ',
  page_anomaly_empty: 'ಪ್ರಸ್ತುತ ಫಿಲ್\u200Cಟರ್\u200Cಗಳಿಗೆ ಹೊಂದಿಕೆಯಾಗುವ ಅಸಾಮಾನ್ಯತೆಗಳು ಇಲ್ಲ.',

  // Offenders page
  page_offender_title: 'ಅಪರಾಧಿ ಡೋಸಿಯರ್ ಡೇಟಾಬೇಸ್',
  page_offender_subtitle: 'ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿ ನೋಂದಣಿ & ಸಿಸ್ಟಮ್ ಸುರಕ್ಷತಾ ಲಾಗ್',
  page_offender_dossier_db: 'ಅಪರಾಧಿ ಡೋಸಿಯರ್ ಡೇಟಾಬೇಸ್',
  page_offender_search_alias: 'ಅಡ್ಡಹೆಸರು, ಅಪರಾಧ ಪ್ರಕಾರ ಅಥವಾ ಪ್ರಕರಣ ಲಿಂಕ್\u200Cನಿಂದ ಹುಡುಕಿ...',
  page_offender_cryptographic_audit: 'ಸಿಸ್ಟಮ್ ಸುರಕ್ಷತೆ & ಕ್ರಿಪ್ಟೋಗ್ರಾಫಿಕ್ ಆಡಿಟ್ ಲಾಗ್',
  page_offender_clear_screen: 'ಸ್ಕ್ರೀನ್ ತೆರವುಗೊಳಿಸಿ',
  page_offender_watermark: 'ವರ್ಗೀಕೃತ ಅಪರಾಧಿ ಗುಪ್ತಚರ ಡೋಸಿಯರ್',
  page_offender_no_dossier: 'ವಿವರವಾದ ಗುಪ್ತಚರವನ್ನು ನೋಡಲು ಅಪರಾಧಿ ಡೋಸಿಯರ್ ಆಯ್ಕೆಮಾಡಿ.',

  // Victims page
  page_victim_title: 'ಬಾಧಿತ ಡೋಸಿಯರ್ ಡೇಟಾಬೇಸ್',
  page_victim_subtitle: 'ಸಾಕ್ಷಿ ರಕ್ಷಣಾ ನೋಂದಣಿ',
  page_victim_registry: 'ಬಾಧಿತ ಮತ್ತು ಸಾಕ್ಷಿ ನೋಂದಣಿ',
  page_victim_search: 'ಹೆಸರು, ವೃತ್ತಿ ಅಥವಾ ಬಾಧಿತ ಸ್ಥಿತಿಯಿಂದ ಹುಡುಕಿ...',
  page_victimology_toggle: 'ಬಾಧಿತಶಾಸ್ತ್ರ ವಿಶ್ಲೇಷಣೆ',
  page_victim_back_dossiers: 'ಬಾಧಿತ ಡೋಸಿಯರ್\u200Cಗಳಿಗೆ ಹಿಂದೆ',
  page_victim_statement: 'ಬಾಧಿತ ಹೇಳಿಕೆ',
  page_victim_linked_cases: 'ಸಂಬಂಧಿತ ಅಪರಾಧ ಪ್ರಕರಣಗಳು',

  // Officers page
  page_officer_title: 'ಅಧಿಕಾರಿ ನಿರ್ವಹಣೆ',
  page_officer_subtitle: 'ಪಡೆ ಸಿಬ್ಬಂದಿ ನಿರ್ದೇಶಿಕೆ',
  page_officer_search: 'ಹೆಸರು, ಬ್ಯಾಜ್ ID ಅಥವಾ ಜಿಲ್ಲೆಯಿಂದ ಹುಡುಕಿ...',
  page_officer_add: 'ಅಧಿಕಾರಿ ಸೇರಿಸಿ',
  page_officer_rank: 'ಪದವಿ',
  page_officer_station: 'ಠಾಣೆ',
  page_officer_district: 'ಜಿಲ್ಲೆ',
  page_officer_filter: 'ಪದವಿ ಅಥವಾ ಜಿಲ್ಲೆಯಿಂದ ಅಧಿಕಾರಿಗಳನ್ನು ಫಿಲ್\u200Cಟರ್ ಮಾಡಿ',

  // Network page
  page_network_title: 'ಅಪರಾಧಿ ಜಾಲ ಗುಪ್ತಚರ',
  page_network_subtitle: 'ಗ್ರಾಫ್ ಲಿಂಕ್ ವಿಶ್ಲೇಷಣಾ ಎಂಜಿನ್ — Neo4j ವರ್ಧಿತ',
  page_network_empty: 'ಆಯ್ಕೆಮಾಡಿದ ವ್ಯಾಪ್ತಿಗೆ ಯಾವುದೇ ಸಂಬಂಧಗಳು ಕಂಡುಬಂದಿಲ್ಲ.',
  page_network_focus_mode: 'ಕೇಂದ್ರೀಕರಣ ಕ್ರಮ',
  page_network_exit: 'ಹೊರಬನ್ನಿ',
  page_network_clear_filters: 'ಫಿಲ್\u200Cಟರ್\u200Cಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ',
  page_network_dataset_scope: 'ಡೇಟಾಸೆಟ್ ವ್ಯಾಪ್ತಿ',
  page_network_no_relationships: 'ಆಯ್ಕೆಮಾಡಿದ ಮಾನದಂಡಗಳಿಗೆ ಸಂಬಂಧಗಳು ಪತ್ತೆಯಾಗಿಲ್ಲ.',

  // Sociological page
  page_socio_title: 'ಸಾಮಾಜಿಕ ಗುಪ್ತಚರ',
  page_socio_subtitle: 'ಕರ್ನಾಟಕ ಜಿಲ್ಲೆಗಳಿಗೆ ಜನಗಣತಿ 2011 & ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ಸೂಚಕಗಳು',
  page_socio_loading: 'ಸಾಮಾಜಿಕ ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
  page_socio_refresh: 'ಡೇಟಾ ರಿಫ್\u200Cರೆಶ್',
  page_socio_overview: 'ಅವಲೋಕನ',
  page_socio_demographics: 'ಜನಸಂಖ್ಯಾಶಾಸ್ತ್ರ',
  page_socio_geographic: 'ಭೌಗೋಳಿಕ',
  page_socio_socioeconomic: 'ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ',
  page_socio_temporal: 'ಕಾಲಾವಧಿ',
  page_socio_offender_profile: 'ಅಪರಾಧಿ ಪ್ರೊಫೈಲ್',

  // Strategic page
  page_strategic_title: 'ತಂತ್ರಾತ್ಮಕ ಆದೇಶ',
  page_strategic_subtitle: 'ಜಿಲ್ಲೆ ಹೀಟ್\u200Cಮ್ಯಾಪ್ • ಸಂಪನ್ಮೂಲ ಹಂಚಿಕೆ • ಹಸ್ತಕ್ಷೇಪ ಗುಪ್ತಚರ',
  page_strategic_loading: 'ತಂತ್ರಾತ್ಮಕ ಗುಪ್ತಚರ ರಚಿಸಲಾಗುತ್ತಿದೆ...',
  page_strategic_refresh: 'ಗುಪ್ತಚರ ರಿಫ್\u200Cರೆಶ್',
  page_strategic_daily_summary: 'ದೈನಂದಿನ ಗುಪ್ತಚರ ಸಾರಾಂಶ',
  page_strategic_command_overview: 'ತಂತ್ರಾತ್ಮಕ ಆದೇಶ ಅವಲೋಕನ',
  page_strategic_risk_districts: 'ಹೆಚ್ಚಿನ ಅಪಾಯದ ಜಿಲ್ಲೆಗಳು',
  page_strategic_emerging_trends: 'ಹೊರಹೊಮ್ಮುತ್ತಿರುವ ಅಪರಾಧ ಪ್ರವೃತ್ತಿಗಳು',
  page_strategic_deployment: 'ಸಂಪನ್ಮೂಲ ನಿಯೋಜನೆ ಸೂಚನೆಗಳು',
  page_strategic_interventions: 'ಹಸ್ತಕ್ಷೇಪ ಪರಿಣಾಮಕಾರಿತ್ವ',
  page_strategic_top_networks: 'ಶೀರ್ಷ ಸಕ್ರಿಯ ಅಪರಾಧಿ ಜಾಲಗಳು',

  // Notifications page
  page_notif_title: 'ಅಧಿಸೂಚನಾ ಕೇಂದ್ರ',
  page_notif_subtitle: 'ರಿಯಲ್\u200Cಟೈಮ್ ಗುಪ್ತಚರ ಫೀಡ್ & ಎಚ್ಚರಿಕೆ ನಿರ್ವಹಣೆ',
  page_notif_messages: 'ಸಂದೇಶಗಳು',
  page_notif_timeline: 'ಕಾಲಾವಧಿ',
  page_notif_activity: 'ಚಟುವಟಿಕೆ',
  page_notif_health: 'ಆರೋಗ್ಯ',
  page_notif_mark_all_read: 'ಎಲ್ಲಾ ಓದಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ',
  page_notif_inform_station: 'ಠಾಣೆ HO ಗೆ ತಿಳಿಸಿ',

  // AI Chat page
  page_aichat_title: 'ಸಕ್ಷ AI ವಿಶ್ಲೇಷಕ',
  page_aichat_welcome: 'ನಮಸ್ಕಾರ, ಅಧಿಕಾರಿ.',
  page_aichat_welcome_sub: 'ನಿಮ್ಮ ಬಹು-ಸುತ್ತಿನ ಸ್ಥಿರ ಗುಪ್ತಚರ ವಿಶ್ಲೇಷಕ ಆರಂಭಿಸಲಾಗಿದೆ. ನಾನು INDIGO ಕಾರ್ಯಾಚರಣಾ ಪ್ರೋಟೋಕಾಲ್ ಅಡಿಯಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ, ಆಳವಾದ ಸಂದರ್ಭಾತ್ಮಕ ಉತ್ತರಗಳನ್ನು ಒದಗಿಸುತ್ತೇನೆ. ಇಂದು ನಿಮ್ಮ ತನಿಖೆಗೆ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
  page_aichat_temp_notice: 'ಸ್ಥಿರ ಸ್ಮರಣೆ ಪ್ರಸ್ತುತ ನಿರ್ವಹಣಾ ಕ್ರಮದಲ್ಲಿದೆ. ಈ ಅಧಿವೇಶನ ತಾತ್ಕಾಲಿಕ. ನಿರ್ಣಾಯಕ ಗುಪ್ತಚರಕ್ಕಾಗಿ, ನಿಮ್ಮ ಕಂಡುಹಿಡಿದವುಗಳನ್ನು ಹೊರಗಡೆ ಉಳಿಸಿ.',
  page_aichat_new_chat: 'ಹೊಸ ಚಾಟ್',
  page_aichat_temp_chat: 'ತಾತ್ಕಾಲಿಕ ಚಾಟ್',
  page_aichat_search_history: 'ಇತಿಹಾಸ ಹುಡುಕಿ...',
  page_aichat_delete_all: 'ಎಲ್ಲಾ ಇತಿಹಾಸ ಅಳಿಸಿ',
};

const kn_en: TranslationSet = {
  // Navigation
  nav_dashboard: 'Dashboard',
  nav_command_center: 'Aadesha Kendra',
  nav_intelligence: 'Guptachara',
  nav_intelligence_engine: 'Prakarana Guptachara',
  nav_intelligence_fusion: 'Ogguudida Guptachara',
  nav_fir: 'FIR',
  nav_hotspot: 'Hotspotgalu',
  nav_network: 'Samparkagalu',
  nav_predictive: 'Apaya Notha',
  nav_anomaly: 'Asamanya ChatuvaTe',
  nav_crime_cases: 'Aparadha Prakaranagalu',
  nav_investigation: 'Tanike',
  nav_notifications: 'Adhisuchanegalu',
  nav_offenders: 'Aparadhigalu',
  nav_criminals: 'Aparadhigalu',
  nav_victims: 'Badhitaru',
  nav_officers: 'Adhikarigalu',
  nav_evidence: 'Saakshya',
  nav_reports: 'Varadhigalu',
  nav_sociological: 'Samudaya Madharigalu',
  nav_strategic: 'Tantratmaka',
  nav_ai_chat: 'AI Chat',
  nav_settings: 'Settingsgalu',
  nav_admin: 'Nirvahaka',
  nav_docs: 'Dastavejgalu',
  nav_identity: 'Guritina Hōndāṇike',
  nav_face_recognition: 'Mukha Gurutisuvike',

  // Common actions
  action_search: 'Huduku',
  action_save: 'Ulisi',
  action_cancel: 'Raddumadi',
  action_delete: 'Alisi',
  action_edit: 'Thiddupadi',
  action_create: 'Rachisi',
  action_export: 'Raptu',
  action_filter: 'Filter',
  action_back: 'Hindhe',
  action_close: 'Muchchi',
  action_confirm: 'Khachithapadisi',
  action_loading: 'Load Aguttide',
  action_refresh: 'Refresh',
  action_view: 'Veekshisi',
  action_add: 'Serisi',

  // FIR page
  fir_title: 'Prathama Maathiri Varadhigalu',
  fir_subtitle: 'FIR Jeevanachakra Nirvahane',
  fir_directory: 'FIR Directory',
  fir_search_hint: 'Sankhye, doorudara athava sectiongalinda huduki...',
  fir_complainant: 'Doorudara',
  fir_contact: 'Samparka',
  fir_sections: 'Sectiongalu',
  fir_narrative: 'Kathavastu',
  fir_status_registered: 'Nondhaalisalagide',
  fir_status_inquiry: 'Tanikheyallide',
  fir_status_resolved: 'Pariharaisalagide',
  fir_accused: 'Aaropi',
  fir_victims: 'Badhitaru',
  fir_no_fir_selected: 'FIR Aaykemadilla',
  fir_select_hint: 'Vivaragalannu nodalu directoryyinda FIR Aaykemadi',
  fir_create_new: 'Hosa FIR Rachisi',
  fir_edit: 'FIR Thiddupadi',
  fir_purge: 'FIR Alisi',
  fir_build_intelligence: 'Guptachara Nirmisi',
  fir_case_link: 'Prakarana Link',
  fir_officer: 'Niyojita Adhikari',
  fir_unassigned: 'Niyojisalagilla',
  fir_risk_index: 'Apaya Suchyanka',

  // Criminals page
  criminal_title: 'Aparadhi Nondhanee',
  criminal_subtitle: 'Aparadhi Profilgalu Mattu Guptachara',
  criminal_index: 'Aparadhi Suchyanka',
  criminal_search_hint: 'Hesaru, addahesaru athava ganginda huduki...',
  criminal_status: 'Sthithi',
  criminal_risk: 'Apaya Score',
  criminal_aliases: 'Addahesarugalu',
  criminal_dob: 'Huttida Dinanka',
  criminal_gender: 'Linga',
  criminal_gang: 'Gang Serpade',
  criminal_address: 'Vilaasa',
  criminal_marks: 'Gurutina Gurutugalu',
  criminal_mo: 'Kaaryavidhaana',
  criminal_linked_cases: 'Sambandhita Prakaranagalu',
  criminal_network: 'Jaala',
  criminal_similar: 'Holuvu Aparadhigalu',
  criminal_open_dossier: 'Dossier Tereyiri',
  criminal_build_intelligence: 'Guptachara Nirmisi',

  // Investigation page
  investigation_title: 'Tanike Kendra',
  investigation_subtitle: 'Ekeekruta Prakarana Tanike Dashboard',
  investigation_cases: 'Sakriya Prakaranagalu',
  investigation_search: 'Prakaranagalu Huduki',
  investigation_detail: 'Prakarana Vivara',
  investigation_timeline: 'Kaalavadhi',
  investigation_firs: 'FIRgalu',
  investigation_criminals: 'Aparadhigalu',
  investigation_evidence: 'Saakshya',
  investigation_ai_recommendations: 'AI Shifaarusugalu',
  investigation_ai_chat: 'AI Chat',
  investigation_mo_patterns: 'MO Maadarigalu',

  // Intelligence Engine
  intel_title: 'Guptachara Engine',
  intel_subtitle: 'Prakaranantara Maadari Vishleshaneyu Aparadha DNA',
  intel_build: 'Guptachara Nirmisi',
  intel_building: 'Guptachara Nirmisalaguttide...',
  intel_summary: 'Saaransha',
  intel_connections: 'Samparkagalu',
  intel_common_threads: 'Saamanya Dhagegalu',
  intel_case_comparison: 'Prakarana Holike',
  intel_crime_dna: 'Aparadha DNA',
  intel_investigation_leads: 'Tanike Sulivugal',
  intel_timeline: 'Kaalavadhi',
  intel_network: 'Jaala',
  intel_pattern_breaks: 'Maadari Murithagalu',
  intel_anomalies: 'Asamanyategalu',
  intel_evidence_trail: 'Saakshya Haadhi',
  intel_confidence: 'Vishwasaarhate',
  intel_confirmed: 'Khachita',
  intel_probable: 'Sambhavya',
  intel_possible: 'Saadhya',
  intel_insufficient_data: 'Apoorna Data',
  intel_explainability: 'Vivaraneyuktate',
  intel_supporting_records: 'Bembara Daakhelegalu',
  intel_start_hint: 'Prakaranantara Guptachara Vishleshaneyu Prarambhisollu Ghatakagalu Aaykemadi',
  intel_select_entity: 'Ghataka Aaykemadi',
  intel_no_connections: 'Yaavude Samparkagalu Kandubandilla',
  intel_no_threads: 'Yaavude Saamanya Dhagegalu Guruthisalagilla',
  intel_no_leads: 'Yaavude Tanike Sulivugal Utpadhisalagilla',
  intel_pattern_baseline: 'Maadari Aadhararekhe',
  intel_pattern_deviation: 'Maadari Vichalana',
  intel_new_analysis: 'Hosa Vishleshane',
  intel_search_placeholder: 'FIR sankhye, prakarana sankhye, hesaru athava addahesaru hindhe huduki…',
  intel_capabilities: 'Engine Samarthyangalu',
  intel_recent_analyses: 'Itticheena Vishleshanegalu',
  intel_no_history: 'Vishleshanegalu Innillaa',
  intel_no_history_hint: 'Mele hudukuvininda nimma modala guptachara varadhi nirmisi.',
  intel_loading_history: 'Itihaasa Load aguttide…',
  intel_searching: 'Nondhanee hudukalaguttide…',
  intel_no_results: 'Yaavude Ghatakagalu Kandubandilla',
  intel_no_results_hint: 'FIR sankhye, prakarana sankhye, aparadhi hesaru/addahesaru athava badhitaru hesaru prayatnisi. Prakaara filter humadisiri.',
  intel_entities: 'Ghatakagalu',
  intel_remove_history: 'Itihaasadyinda Thegeyiri',
  intel_start_any: 'Yaavude FIR, prakarana, aparadhi athava badhitaru indha ekeekruta guptachara varadhi rachisi.',

  // Dashboard
  dashboard_title: 'Aadesha Kendra',
  dashboard_subtitle: 'Karnataka Rajya Police Guptachara Avalokana',
  dashboard_total_cases: 'Ottu Prakaranagalu',
  dashboard_active_firs: 'Sakriya FIRgalu',
  dashboard_open_cases: 'Thereda Prakaranagalu',
  dashboard_risk_alerts: 'Apaya EchcharigalU',

  // Common UI
  ui_no_data: 'Data Illa',
  ui_error: 'Dosha',
  ui_retry: 'Maruprayatna',
  ui_empty_state: 'Yaavude Data Labhyavilla',
  ui_confirm_delete: 'Neeku Khachitavagi Idannu Alisalu Belisutta?',
  ui_filter_all: 'Ellaa',
  ui_status_open: 'Thereda',
  ui_status_closed: 'Muchchalagide',
  ui_status_active: 'Sakriya',
  ui_priority_critical: 'Gambheera',
  ui_priority_high: 'Hechhu',
  ui_priority_medium: 'Madhyama',
  ui_priority_low: 'Kadime',

  // Settings
  settings_title: 'Settingsgalu',
  settings_profile: 'Profile',
  settings_system: 'System',
  settings_help: 'Saharaaya',
  settings_language: 'Bhaashe',
  settings_language_preference: 'Bhaashe Aadyathe',
  settings_language_hint: 'Interfacge Nimma Aadyatheya Bhaasheyannu Aaykemadi',
  settings_english: 'English',
  settings_kannada: 'Kannada',
  settings_kanglish: 'Kanglish',
  settings_ai_language_note: 'AI Chat Bhaashe UI Bhaasheyinda Swatantra',

  // Evidence
  evidence_title: 'Saakshya Nirvahane',
  evidence_chain: 'Custody Sarapali',
  evidence_upload: 'Saakshya Upload',
  evidence_type: 'Saakshya Prakaara',
  evidence_no_data: 'Saakshya Labhyavilla',
  evidence_search_hint: 'Prakaara, prakarana athava vivaraneyinda saakshya huduki...',
  evidence_status: 'Sthithi',
  evidence_officer: 'Niyojita Adhikari',
  evidence_upload_date: 'Upload Dinanka',
  evidence_hash: 'File Hash',

  // Crime Cases
  cc_title: 'Saksha Aparadha Guptachara Prakaranagalu',
  cc_subtitle: 'Operator System Profile Clearance Level',
  cc_create: 'Aparadha Prakarana Rachisi',
  cc_search_hint: 'Prakarana sankhye, vivaraneyinda huduki...',
  cc_all_status: 'Ella Sthithi Mattagalu',
  cc_all_categories: 'Ella Vargagalu',
  cc_all_districts: 'Ella Jillagalu',
  cc_all_priorities: 'Ella Aadyathegalu',
  cc_case_details: 'Prakarana Vivaragalu',
  cc_occurred_at: 'Sambhavisida Samaya',
  cc_status: 'Sthithi',
  cc_priority: 'Aadyathe',
  cc_progress: 'Pragathi Tracker',
  cc_actions: 'Kriyegalu',
  cc_view: 'Prakarana Dossier Nodiri',
  cc_edit: 'Sancharane Thiddupadi',
  cc_purge: 'Prakarana Daakhele Alisi',
  cc_no_cases: 'Prasthuta Telemetry Filtergalige Halmiyaguva Sakriya Aparadha Prakaranagalu Illa',
  cc_no_description: 'Vivaraneyilla',
  cc_reset: 'Maruhumadisi',
  cc_back: 'Prakaranagalige Hindhe',
  cc_description: 'Vivarane',
  cc_category: 'Varga',
  cc_district: 'Jilla',
  cc_assigned_officer: 'Niyojita Adhikari',
  cc_investigation_notes: 'Tanike Tippanigalu',
  cc_add_note: 'Tippani Serisi',
  cc_linked_firs: 'Sambandhita FIRgalu',
  cc_link_fir: 'FIR Link Maadiri',
  cc_ai_insights: 'AI Prakarana Olanotigalu',

  // Reports
  reports_title: 'Varadhigalu',
  reports_generate: 'Varadhi Rachisi',
  reports_export: 'Varadhi Raptu',

  // Notifications
  notifications_title: 'Adhisuchanegalu',
  notifications_unread: 'Odilla',
  notifications_mark_read: 'Oodalagide Endu Gurutisi',

  // Login
  login_title: 'Saksha',
  login_subtitle: 'Aparadha Guptachara Mattu Vishleshaneya Vedike',
  login_badge_hint: 'Sign In Madalu Nimma Badge ID Nomadisi',
  login_face_auth: 'Mukha Drudheekarana',

  // Footer
  footer_version: 'v2.3.2',
  footer_stamp: 'Vargeekruta Telemetry Databasegalu Lock',

  // Hotspots page
  page_hotspot_title: 'Hotspot Vishleshaneyu',
  page_hotspot_subtitle: 'AI Aparadha Maadari Vishleshaneyu • Embedded Bhoomi Guptachara',
  page_hotspot_loading: 'Hotspotgalu Load aguttide...',
  page_hotspot_vector_map: 'Hotspot Vector Nakshae',
  page_hotspot_matrix: 'Aparadha Varga × Vaarada Dina Heat Matrix',
  page_hotspot_export: 'Hotspot Data Raptu',
  page_hotspot_emerging_alerts: 'Horahommuva Hotspot Echcharigalu',
  page_hotspot_red_zone: 'Kempu Valaya',

  // Predictions page
  page_predict_title: 'AI Aparadha Moonsuchana Guptachara',
  page_predict_loading: 'Moonsuchanegalu Load aguttide...',
  page_predict_seasonal: 'Rutumaanada Aparadha Maadari',
  page_predict_emerging: 'Horahommuva Bedarike Moolyamana',
  page_predict_threat: 'Bedarike Mattu:',
  page_predict_model_metrics: 'Moonsuchana Maadari Maapanagalu',
  page_predict_no_seasonal: 'Prasthuta Avadhige Rutumaanada Data Labhyavilla.',
  page_predict_no_trend: 'Pravrutti Niradharisalu Apoorna Data.',

  // Anomalies page
  page_anomaly_title: 'Asamanyate Patte Kendra',
  page_anomaly_search: 'Prakarana ID yinda asamanyategalu huduki...',
  page_anomaly_severity: 'Teevrate',
  page_anomaly_investigation: 'Tanike Avasyavide',
  page_anomaly_detail: 'Asamanyate Vivara',
  page_anomaly_offence_desc: 'Aparadha Vivarane',
  page_anomaly_feature_explain: 'Asamanyate Score ge Vaishishtya Koduge',
  page_anomaly_empty: 'Prasthuta Filtergalige Halmiyaguva Asamanyategalu Illa.',

  // Offenders page
  page_offender_title: 'Aparadhi Dossier Database',
  page_offender_subtitle: 'Punaravartita Aparadhi Nondhanee & System Surakshita Log',
  page_offender_dossier_db: 'Aparadhi Dossier Database',
  page_offender_search_alias: 'Addahesaru, Aparadha Prakaara athava Prakarana Link inda huduki...',
  page_offender_cryptographic_audit: 'System Surakshate & Cryptographic Audit Log',
  page_offender_clear_screen: 'Screen Teravumadisi',
  page_offender_watermark: 'Vargeekruta Aparadhi Guptachara Dossier',
  page_offender_no_dossier: 'Vivaravada Guptachara Nodalu Aparadhi Dossier Aaykemadi.',

  // Victims page
  page_victim_title: 'Badhita Dossier Database',
  page_victim_subtitle: 'Saakshi Rakshana Nondhanee',
  page_victim_registry: 'Badhita Mattu Saakshi Nondhanee',
  page_victim_search: 'Hesaru, Vruthi athava Badhita Sthithiyinda huduki...',
  page_victimology_toggle: 'BadhitaShastra Vishleshaneyu',
  page_victim_back_dossiers: 'Badhita Dossiergalige Hindhe',
  page_victim_statement: 'Badhita Heḷḷike',
  page_victim_linked_cases: 'Sambandhita Aparadha Prakaranagalu',

  // Officers page
  page_officer_title: 'Adhikari Nirvahane',
  page_officer_subtitle: 'Pade Cibbandi Nirdeshae',
  page_officer_search: 'Hesaru, Badge ID athava Jilla inda huduki...',
  page_officer_add: 'Adhikari Serisi',
  page_officer_rank: 'Padavi',
  page_officer_station: 'Thaane',
  page_officer_district: 'Jilla',
  page_officer_filter: 'Padavi athava Jillayinda Adhikarigalu Filter Maadiri',

  // Network page
  page_network_title: 'Aparadhi Jaala Guptachara',
  page_network_subtitle: 'Graph Link Vishleshana Engine — Neo4j Vardhita',
  page_network_empty: 'Aaykemadida Vyaapthige Yaavude Sambandhagalu Kandubandilla.',
  page_network_focus_mode: 'Kendreekarana Krama',
  page_network_exit: 'Horbanni',
  page_network_clear_filters: 'Filtergalannu Teravu Maadisi',
  page_network_dataset_scope: 'Dataset Vyaapthi',
  page_network_no_relationships: 'Aaykemadida Maanadandgalige Sambandhagalu Pattedeagilla.',

  // Sociological page
  page_socio_title: 'Samajika Guptachara',
  page_socio_subtitle: 'Karnataka Jillagalige Janaganathi 2011 & Samajika-Aarthika Suchakagalu',
  page_socio_loading: 'Samajika Data Load aguttide...',
  page_socio_refresh: 'Data Refresh',
  page_socio_overview: 'Avalokana',
  page_socio_demographics: 'Janasankhyashastra',
  page_socio_geographic: 'Bhaugolika',
  page_socio_socioeconomic: 'Samajika-Aarthika',
  page_socio_temporal: 'Kaalavadhi',
  page_socio_offender_profile: 'Aparadhi Profile',

  // Strategic page
  page_strategic_title: 'Tantratmaka Aadesha',
  page_strategic_subtitle: 'Jilla Heatmap • Sampanna Hamshekae • Hastaakhshepa Guptachara',
  page_strategic_loading: 'Tantratmaka Guptachara Rachisalaguttide...',
  page_strategic_refresh: 'Guptachara Refresh',
  page_strategic_daily_summary: 'Dainandina Guptachara Saaransha',
  page_strategic_command_overview: 'Tantratmaka Aadesha Avalokana',
  page_strategic_risk_districts: 'Hechhu Apaya Jillagalu',
  page_strategic_emerging_trends: 'Horahommuva Aparadha Pravrutigalu',
  page_strategic_deployment: 'Sampanna Niyojane Soodhanagalu',
  page_strategic_interventions: 'Hastaakhshepa Pranamaakaaritva',
  page_strategic_top_networks: 'Sheersha Sakriya Aparadhi Jaalagalu',

  // Notifications page
  page_notif_title: 'Adhisuchana Kendra',
  page_notif_subtitle: 'Real-Time Guptachara Feed & Echcharika Nirvahane',
  page_notif_messages: 'Sandesha',
  page_notif_timeline: 'Kaalavadhi',
  page_notif_activity: 'Chatuvatike',
  page_notif_health: 'Arogya',
  page_notif_mark_all_read: 'Ella Oodalagide Endu Gurutisi',
  page_notif_inform_station: 'Thaane HO ge Thilisi',

  // AI Chat page
  page_aichat_title: 'Saksha AI Vishleshaka',
  page_aichat_welcome: 'Namaskaara, Adhikari.',
  page_aichat_welcome_sub: 'Nimma Bahu-Suttina Sthira Guptachara Vishleshaka Arambhisalagide. Naanu INDIGO Karyacharana Protocol adiyalli Kaelasa Maaduttene, Aadvada Sandarbhatmaka Utharagalu Odegisuttene. Indu Nimma Tanikege Naanu Hege Sahaya Maadabahudu?',
  page_aichat_temp_notice: 'Sthira Smarane Prasthuta Nirvahana Kramadallide. Ee Adhiveshana Taatkalika. Nirnaayaka Guptacharake, Nimma Kanduhiddivannu Horage Uḷisi.',
  page_aichat_new_chat: 'Hosa Chat',
  page_aichat_temp_chat: 'Taatkalika Chat',
  page_aichat_search_history: 'Itihaasa Huduki...',
  page_aichat_delete_all: 'Ella Itihaasa Alisi',
};

export const translations: Record<Language, TranslationSet> = {
  en,
  kn,
  'kn-en': kn_en,
};
