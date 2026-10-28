<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LegacyGridContainLabel } from 'echarts/features'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  LegacyGridContainLabel,
  CanvasRenderer
])

const props = defineProps({
  option: { type: Object, default: () => ({}) },
  height: { type: String, default: '280px' }
})

const el = ref(null)
let chart = null
let observer = null

function render() {
  if (!chart || !props.option) return
  chart.setOption(props.option, true)
}

onMounted(() => {
  chart = echarts.init(el.value)
  render()

  observer = new ResizeObserver(() => {
    chart?.resize()
  })
  observer.observe(el.value)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="base-chart" :style="{ height, width: '100%' }"></div>
</template>

<style scoped>
.base-chart {
  min-height: 120px;
}
</style>
