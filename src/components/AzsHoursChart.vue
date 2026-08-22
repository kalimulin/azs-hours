<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import type { DailySummary } from '@/types'
import { format, parseISO } from 'date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps<{
  data: DailySummary[]
}>()

const chartData = computed(() => {
  return {
    labels: props.data.map(d => {
      try {
        return format(parseISO(d.date), 'dd.MM')
      } catch {
        return d.date
      }
    }),
    datasets: [
      {
        label: 'АЗС-часы',
        backgroundColor: 'rgba(24, 160, 88, 0.2)',
        borderColor: '#18a058',
        borderWidth: 2,
        pointBackgroundColor: '#18a058',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#18a058',
        fill: true,
        data: props.data.map(d => d.total_azs_hours)
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      intersect: false,
      mode: 'index' as const,
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Часы работы'
      }
    }
  }
}
</script>

<template>
  <div class="chart-container">
    <Line v-if="data.length > 0" :data="chartData" :options="chartOptions" />
    <div v-else class="empty-state">
      Нет данных для графика
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}
</style>
