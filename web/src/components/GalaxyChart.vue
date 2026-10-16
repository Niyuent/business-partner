<template>
  <div ref="el" class="galaxy-chart" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { DashboardGalaxy } from '@/api/report';

// 按需引入：星系视图只用 graph + tooltip
use([GraphChart, TooltipComponent, CanvasRenderer]);

const props = defineProps<{ data: DashboardGalaxy | null }>();
const router = useRouter();
const el = ref<HTMLDivElement>();
let chart: ECharts | null = null;

/** 商家状态 → 星球颜色 */
const STATUS_COLOR: Record<string, string> = {
  APPROVED: '#34d399',
  PENDING: '#fbbf24',
  SUSPENDED: '#f87171',
  REJECTED: '#94a3b8',
};
const BRAND = '#4f7cff';

const yuan = (v: number) => `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;

function buildOption(): EChartsCoreOption {
  const data = props.data;
  if (!data) return {};
  const w = el.value?.clientWidth ?? 960;
  const h = el.value?.clientHeight ?? 640;
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2);
  // 交易额最大者作为基准，用 sqrt 压缩量级差异，避免小星球看不见
  const max = Math.max(1, ...data.planets.map((p) => p.monthAmount));

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 900,
    animationEasing: 'cubicOut',
    tooltip: {
      confine: true,
      appendToBody: true,
      backgroundColor: 'rgba(15,23,42,0.92)',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => {
        if (p?.dataType !== 'node' || !p?.data) return '';
        if (p.data.kind === 'center') {
          return `<b>${p.data.name}</b><br/>本月交易额 ${yuan(p.data.monthAmount)}<br/>本月订单 ${p.data.monthOrderCount} 笔 · 附属 ${p.data.planetCount} 家`;
        }
        return `<b>${p.data.name}</b><br/>本月交易额 ${yuan(p.data.monthAmount)}<br/>本月订单 ${p.data.orderCount} 笔<br/>状态 ${p.data.status}<br/><span style="color:#94a3b8">点击查看商家详情 →</span>`;
      },
    },
    series: [
      {
        id: 'galaxy',
        type: 'graph',
        layout: 'force',
        roam: false,
        draggable: false,
        center: [cx, cy],
        force: { repulsion: 300, edgeLength: 130, gravity: 0.1, friction: 0.25 },
        emphasis: { scale: 1.4, focus: 'adjacency', label: { show: true, fontSize: 12 } },
        label: { show: true, color: '#cbd5e1', fontSize: 11 },
        edgeSymbol: ['none', 'none'],
        lineStyle: { color: 'rgba(148,163,184,0.22)', width: 1, curveness: 0.14 },
        data: [
          {
            ...data.center,
            id: data.center.id,
            name: data.center.name,
            kind: 'center',
            // 中心固定在容器正中：呼吸光环（CSS）才能与它对齐
            fixed: true,
            x: cx,
            y: cy,
            symbolSize: 68,
            itemStyle: {
              color: BRAND,
              borderColor: '#ffffff',
              borderWidth: 2,
              shadowBlur: 28,
              shadowColor: 'rgba(79,124,255,0.65)',
            },
            label: { show: true, fontSize: 13, fontWeight: 700, color: '#ffffff' },
          },
          ...data.planets.map((p) => ({
            ...p,
            kind: 'planet',
            merchantId: p.id,
            symbolSize: 16 + 30 * Math.sqrt(p.monthAmount / max),
            itemStyle: {
              color: STATUS_COLOR[p.status] ?? '#64748b',
              shadowBlur: 12,
              shadowColor: 'rgba(0,0,0,0.35)',
            },
          })),
        ],
        links: data.flows.map((f) => ({ source: f.source, target: f.target, value: f.value })),
      },
    ],
  };
}

function render() {
  if (!el.value) return;
  if (!chart) chart = init(el.value);
  chart.clear();
  chart.setOption(buildOption());
}

function onResize() {
  if (!chart || !el.value) return;
  chart.resize();
  // 中心节点钉在容器中心，resize 后重新定位
  chart.setOption(buildOption());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onClick(params: any) {
  if (params?.dataType !== 'node') return;
  const id = params.data?.kind === 'center' ? params.data?.id : params.data?.merchantId;
  if (typeof id === 'number' && id > 0) router.push(`/main/merchants/${id}`);
}

let observer: ResizeObserver | null = null;

onMounted(() => {
  render();
  chart?.on('click', onClick);
  window.addEventListener('resize', onResize);
  if (typeof ResizeObserver !== 'undefined' && el.value) {
    observer = new ResizeObserver(() => onResize());
    observer.observe(el.value);
  }
  // 自动化验收 / 调试用：只读暴露图表实例（不参与任何业务逻辑）
  (window as unknown as { __galaxyChart?: ECharts }).__galaxyChart = chart ?? undefined;
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  observer?.disconnect();
  observer = null;
  delete (window as unknown as { __galaxyChart?: ECharts }).__galaxyChart;
  chart?.dispose();
  chart = null;
});

watch(
  () => props.data,
  () => render(),
  { deep: true },
);
</script>

<style scoped>
.galaxy-chart {
  width: 100%;
  height: 100%;
}
</style>
