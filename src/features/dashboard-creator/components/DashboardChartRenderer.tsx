import ReactECharts from 'echarts-for-react';
import { Badge } from '@/components/ui/badge';
import type { DashboardChart, DashboardResult } from '../dashboardCreatorApi';
import { businessText, formatValue, getVisualConfig } from './dashboardUtils';

type Props = {
  chart: DashboardChart;
  result: DashboardResult;
};

function chartData(chart: DashboardChart) {
  return chart.data
    .slice(0, 24)
    .map((item, index) => ({
      name: item.label,
      value: Number(item.value) || 0,
      group: item.group,
      color: chart.legend?.find((legend) => legend.label === item.label)?.color || chart.colors?.[index],
    }))
    .filter((item) => item.name && Number.isFinite(item.value));
}

function baseTextColor() {
  return '#334155';
}

function getOption(chart: DashboardChart, result: DashboardResult) {
  const visual = getVisualConfig(result);
  const colors = chart.colors?.length ? chart.colors : [visual.primary, visual.secondary, visual.danger, visual.success, '#2F80ED', '#F59E0B', '#64748B'];
  const data = chartData(chart).map((item, index) => ({
    name: item.name,
    value: item.value,
    itemStyle: { color: item.color || colors[index % colors.length] },
  }));
  const common = {
    backgroundColor: '#FFFFFF',
    color: colors,
    textStyle: { color: baseTextColor(), fontFamily: 'Inter, ui-sans-serif, system-ui' },
    tooltip: { trigger: 'item', valueFormatter: (value: number) => formatValue(value) },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: '#475569', fontSize: 11 } },
    grid: { left: 48, right: 20, top: 24, bottom: 72, containLabel: true },
  };

  if (chart.type === 'pie' || chart.type === 'donut') {
    return {
      ...common,
      series: [{
        type: 'pie',
        radius: chart.type === 'donut' ? ['48%', '72%'] : '72%',
        center: ['50%', '44%'],
        data,
        label: { formatter: '{b}\n{d}%', color: '#334155', fontSize: 11 },
        labelLine: { lineStyle: { color: '#CBD5E1' } },
      }],
    };
  }

  if (chart.type === 'line' || chart.type === 'area') {
    return {
      ...common,
      tooltip: { trigger: 'axis', valueFormatter: (value: number) => formatValue(value) },
      xAxis: { type: 'category', data: data.map((item) => item.name), axisLabel: { color: '#64748B', rotate: data.length > 6 ? 28 : 0 } },
      yAxis: { type: 'value', axisLabel: { color: '#64748B' }, splitLine: { lineStyle: { color: '#E2E8F0' } } },
      series: [{
        type: 'line',
        data: data.map((item) => item.value),
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3, color: colors[0] },
        itemStyle: { color: colors[0] },
        areaStyle: chart.type === 'area' ? { color: `${colors[0]}24` } : undefined,
      }],
    };
  }

  if (chart.type === 'matrix') {
    return {
      ...common,
      xAxis: { type: 'category', data: data.map((item) => item.name), axisLabel: { color: '#64748B', rotate: 35 } },
      yAxis: { type: 'value', axisLabel: { color: '#64748B' }, splitLine: { lineStyle: { color: '#E2E8F0' } } },
      series: [{ type: 'scatter', symbolSize: (value: number) => Math.max(14, Math.min(46, Number(value) * 6)), data: data.map((item) => item.value), itemStyle: { color: colors[1] } }],
    };
  }

  const horizontal = chart.type === 'horizontal_bar';
  return {
    ...common,
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => formatValue(value) },
    xAxis: horizontal
      ? { type: 'value', axisLabel: { color: '#64748B' }, splitLine: { lineStyle: { color: '#E2E8F0' } } }
      : { type: 'category', data: data.map((item) => item.name), axisLabel: { color: '#64748B', rotate: data.length > 6 ? 28 : 0 } },
    yAxis: horizontal
      ? { type: 'category', data: data.map((item) => item.name), axisLabel: { color: '#64748B' } }
      : { type: 'value', axisLabel: { color: '#64748B' }, splitLine: { lineStyle: { color: '#E2E8F0' } } },
    series: [{
      type: 'bar',
      data: data.map((item, index) => ({ value: item.value, itemStyle: { color: item.color || colors[index % colors.length] } })),
      barMaxWidth: 34,
      label: { show: true, position: horizontal ? 'right' : 'top', color: '#334155', fontSize: 11, formatter: ({ value }: { value: number }) => formatValue(value) },
    }],
  };
}

export function DashboardChartRenderer({ chart, result }: Props) {
  const data = chartData(chart);
  if (!data.length) return null;

  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{businessText(chart.title, 'Grafico ejecutivo')}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{businessText(chart.description)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-slate-200 text-slate-600">{chart.type}</Badge>
          {chart.confidence === 'low' ? <Badge variant="outline" className="border-[#F3313F]/30 bg-[#F3313F]/5 text-[#F3313F]">baja confianza</Badge> : null}
        </div>
      </div>
      <div className="mt-4 h-[330px]">
        <ReactECharts option={getOption(chart, result)} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.slice(0, 8).map((item, index) => (
          <div key={`${chart.chart_id}-${item.name}-${index}`} className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color || chart.colors?.[index] || getVisualConfig(result).primary }} />
            <span className="truncate">{item.name}</span>
            <span className="shrink-0 font-medium text-slate-950">{formatValue(item.value)}</span>
          </div>
        ))}
      </div>
      {businessText(chart.insight) ? <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">{businessText(chart.insight)}</p> : null}
    </article>
  );
}
