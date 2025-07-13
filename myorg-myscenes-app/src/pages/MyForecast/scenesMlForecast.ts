// grafana-scenes-ml-forecast.ts
// Sample implementation of Grafana Scenes ML for forecasting and anomaly detection

import {
  SceneApp,
  SceneAppPage,
  SceneFlexLayout,
  SceneFlexItem,
  SceneTimePicker,
  SceneTimeRange,
  SceneRefreshPicker,
  SceneVariableSet,
  QueryVariable,
  PanelBuilders,
  SceneQueryRunner,
  EmbeddedScene,
} from '@grafana/scenes';

import { LegendDisplayMode, TooltipDisplayMode, SortOrder, GraphDrawStyle, LineInterpolation } from '@grafana/schema';

import { SceneBaseliner } from '@grafana/scenes-ml';

// Create a time series panel with ML forecasting
function createForecastPanel(title: string, query: string) {
  // Configure the baseliner for forecasting
  const baseliner = new SceneBaseliner({
    interval: 0.95,              // 95% confidence interval
    discoverSeasonalities: true,  // Auto-detect seasonality patterns
    pinned: false,               // Allow recalculation on state changes
  });

  // Create query runner for the panel
  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'prometheus' }, // Adjust to your datasource
    queries: [
      {
        refId: 'A',
        expr: query,
        interval: '1m',
        format: 'time_series',
      },
    ],
  });

  // Build the time series panel with forecasting
  const panel = PanelBuilders.timeseries()
    .setTitle(title)
    .setData(queryRunner)
    .setHeaderActions([baseliner])  // Add ML forecasting control
    .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right' })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
    .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
    .setCustomFieldConfig('lineWidth', 2)
    .setCustomFieldConfig('fillOpacity', 10)
    .setCustomFieldConfig('pointSize', 4)
    //.setCustomFieldConfig('showPoints', 'never')
    .setCustomFieldConfig('spanNulls', true)
    .build();

  return panel;
}

// Create an anomaly detection panel
function createAnomalyDetectionPanel(title: string, query: string) {
  const baseliner = new SceneBaseliner({
    interval: 0.99,              // Higher confidence for anomaly detection
    discoverSeasonalities: true,
    pinned: false,
  });

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'prometheus' },
    queries: [
      {
        refId: 'A',
        expr: query,
        interval: '30s',
        format: 'time_series',
      },
    ],
  });

  return PanelBuilders.timeseries()
    .setTitle(title)
    .setData(queryRunner)
    .setHeaderActions([baseliner])
    .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'bottom' })
    .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
    .setCustomFieldConfig('lineWidth', 1)
    .setCustomFieldConfig('fillOpacity', 20)
    .setUnit('short')
    .build();
}

// Create a comparative forecast panel
function createComparativeForecastPanel() {
  const baseliner = new SceneBaseliner({
    interval: 0.90,
    discoverSeasonalities: true,
    pinned: false,
  });

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'prometheus' },
    queries: [
      {
        refId: 'A',
        expr: 'rate(http_requests_total[5m])',
        interval: '1m',
        legendFormat: 'HTTP Requests/sec',
      },
      {
        refId: 'B',
        expr: 'rate(cpu_usage_total[5m])',
        interval: '1m',
        legendFormat: 'CPU Usage',
      },
    ],
  });

  return PanelBuilders.timeseries()
    .setTitle('Multi-Metric Forecast Comparison')
    .setData(queryRunner)
    .setHeaderActions([baseliner])
    .setOption('legend', { 
      displayMode: LegendDisplayMode.Table, 
      placement: 'right',
      calcs: ['lastNotNull', 'mean', 'max']
    })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
    .setCustomFieldConfig('lineWidth', 2)
    .setOverrides((b) => {
      b.matchFieldsWithName('HTTP Requests/sec')
        .overrideColor({ mode: 'fixed', fixedColor: 'blue' })
        //.overrideCustomFieldConfig('axisPlacement', 'left');
      
      b.matchFieldsWithName('CPU Usage')
        .overrideColor({ mode: 'fixed', fixedColor: 'red' })
        //.overrideCustomFieldConfig('axisPlacement', 'right');
    })
    .build();
}

// Create the main dashboard scene
function createMLDashboard() {
  // Time range for the dashboard
  const timeRange = new SceneTimeRange({
    from: 'now-24h',
    to: 'now',
  });

  // Variables for dynamic queries
  const variables = new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: 'instance',
        label: 'Instance',
        datasource: { uid: 'prometheus' },
        query: 'label_values(up, instance)',
        value: 'All',
        includeAll: true,
        allValue: '.*',
      }),
      new QueryVariable({
        name: 'job',
        label: 'Job',
        datasource: { uid: 'prometheus' },
        query: 'label_values(up, job)',
        value: 'All',
        includeAll: true,
        allValue: '.*',
      }),
    ],
  });

  // Create the main scene with panels
  const scene = new EmbeddedScene({
    $timeRange: timeRange,
    $variables: variables,
    controls: [
      new SceneTimePicker({}),
      new SceneRefreshPicker({
        intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h'],
        refresh: '30s',
      }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // Row 1: Main forecast panels
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              width: '50%',
              height: 400,
              body: createForecastPanel(
                'CPU Usage Forecast',
                'avg(rate(cpu_usage_seconds_total{instance=~"$instance", job=~"$job"}[5m])) * 100'
              ),
            }),
            new SceneFlexItem({
              width: '50%',
              height: 400,
              body: createForecastPanel(
                'Memory Usage Forecast',
                'avg(memory_usage_bytes{instance=~"$instance", job=~"$job"}) / 1024 / 1024 / 1024'
              ),
            }),
          ],
        }),
        
        // Row 2: Anomaly detection
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              width: '100%',
              height: 400,
              body: createAnomalyDetectionPanel(
                'Network Traffic Anomaly Detection',
                'sum(rate(network_bytes_total{instance=~"$instance", job=~"$job"}[5m]))'
              ),
            }),
          ],
        }),
        
        // Row 3: Comparative forecasts
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              width: '100%',
              height: 400,
              body: createComparativeForecastPanel(),
            }),
          ],
        }),
      ],
    }),
  });

  return scene;
}

// Example usage and export
export function createMLForecastApp() {
  const app = new SceneApp({
  pages: [
    new SceneAppPage({
      title: 'ML Forecasting Dashboard',
      url: '',
      subTitle: 'Predictive analytics with Grafana Scenes ML',
      routePath: '/ml-forecast',
      getScene: () => createMLDashboard(),
    }),
    // Additional pages...
  ],

});

  return app;
}

// Additional utility functions for advanced ML configurations
export class MLForecastUtils {
  // Create a baseliner with custom seasonality detection
  static createAdvancedBaseliner(options?: {
    interval?: number;
    customSeasonalities?: number[];
    anomalyThreshold?: number;
  }) {
    return new SceneBaseliner({
      interval: options?.interval || 0.95,
      discoverSeasonalities: true,
      pinned: false,
      // Note: Custom seasonalities would need to be handled via query transformations
    });
  }

  // Create a panel specifically for long-term forecasting
  static createLongTermForecastPanel(
    title: string,
    query: string,
    forecastHours: number = 24
  ) {
    const baseliner = new SceneBaseliner({
      interval: 0.80, // Lower confidence for longer forecasts
      discoverSeasonalities: true,
      pinned: true,   // Pin for consistent long-term view
    });

    const queryRunner = new SceneQueryRunner({
      datasource: { uid: 'prometheus' },
      queries: [
        {
          refId: 'A',
          expr: query,
          interval: '5m',
          format: 'time_series',
        },
      ],
    });

    return PanelBuilders.timeseries()
      .setTitle(`${title} (${forecastHours}h forecast)`)
      .setData(queryRunner)
      .setHeaderActions([baseliner])
      .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right' })
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setCustomFieldConfig('lineWidth', 2)
      .setCustomFieldConfig('fillOpacity', 15)
      .build();
  }
}

// Export the main dashboard creator
export default createMLForecastApp;