import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UnifiedIntelligenceResult } from '../services/api';
import { SentinelAlertCard } from '../components/intelligence/SentinelAlertCard';

const noop = () => {};

function makePattern(overrides: Partial<UnifiedIntelligenceResult> = {}): UnifiedIntelligenceResult {
  return {
    intelligence_id: 'intel-1',
    pattern_type: 'vehicle theft spike',
    location: { district: 'Bengaluru Urban', stations: [], latitude: 12.97, longitude: 77.59 },
    affected_h3_cells: [],
    time_window: 'last_30_days',
    change_from_baseline: {
      baseline_count: 10,
      current_count: 14,
      change_percentage: 40,
      direction: 'up',
    },
    risk_score: 0.87,
    forecast: null,
    confidence: 0.82,
    supporting_signals: [],
    related_fir_ids: [],
    related_entity_ids: [],
    recommended_action_input: {
      title: 'Surge night patrols',
      action_type: 'patrol_surge',
      description: 'Reallocate two squads.',
      priority: 'high',
      suggested_intervention: null,
    },
    ml_status: 'ok',
    model_name: 'sentinel',
    model_version: 'v1',
    detection_timestamp: '2026-01-01T00:00:00Z',
    explanation: 'Baseline deviation detected.',
    contributing_analytics: {},
    data_provenance: 'live',
    ...overrides,
  };
}

describe('SentinelAlertCard data-source honesty', () => {
  it('shows "No forecast available" instead of inventing a 14-day forecast', () => {
    render(
      <SentinelAlertCard
        pattern={makePattern()}
        onInvestigate={noop}
        onWhyThisInsight={noop}
        onPlanIntervention={noop}
      />,
    );

    expect(screen.getByText('No forecast available')).toBeInTheDocument();
    expect(screen.queryByText(/next 14 days/i)).not.toBeInTheDocument();
  });

  it('renders the real forecast period when the backend supplies one', () => {
    render(
      <SentinelAlertCard
        pattern={makePattern({
          forecast: {
            predicted_crime_count: 42,
            lower_bound: 30,
            upper_bound: 55,
            trend: 'increasing',
            prediction_mode: 'model',
            period: 'next_14_days',
          },
        })}
        onInvestigate={noop}
        onWhyThisInsight={noop}
        onPlanIntervention={noop}
      />,
    );

    expect(screen.getByText('Elevated — next 14 days')).toBeInTheDocument();
  });

  it('marks missing risk/confidence as "No data" rather than fabricating zeros', () => {
    render(
      <SentinelAlertCard
        pattern={makePattern({
          risk_score: Number.NaN,
          confidence: Number.NaN,
        })}
        onInvestigate={noop}
        onWhyThisInsight={noop}
        onPlanIntervention={noop}
      />,
    );

    expect(screen.getAllByText('No data').length).toBeGreaterThanOrEqual(2);
  });
});
