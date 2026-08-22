<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { 
  NLayout, NLayoutHeader, NLayoutContent, NSpace, NRadioGroup, 
  NRadioButton, NCard, NStatistic, NSpin
} from 'naive-ui'
import { useStationsStore } from '@/stores/stations'
import { useWorkHoursStore } from '@/stores/workHours'
import { format, subDays, addDays } from 'date-fns'
import DateNavigator from '@/components/DateNavigator.vue'
import HoursHeatmap from '@/components/HoursHeatmap.vue'
import AzsHoursChart from '@/components/AzsHoursChart.vue'

const stationsStore = useStationsStore()
const workHoursStore = useWorkHoursStore()

const selectedDate = ref(Date.now())
const categoryFilter = ref('all') // 'all', 'city', 'district'

const loading = computed(() => stationsStore.loading || workHoursStore.loading)

// Current date string for queries
const dateStr = computed(() => format(selectedDate.value, 'yyyy-MM-dd'))

// Computed stations based on filter
const filteredStations = computed(() => {
  if (categoryFilter.value === 'all') return stationsStore.stations
  return stationsStore.stations.filter(s => s.category === categoryFilter.value)
})

// Total AZS hours for selected date
const totalAzsHours = computed(() => {
  // Only sum hours for stations that match the filter
  const validStationIds = new Set(filteredStations.value.map(s => s.id))
  
  let total = 0
  for (const wh of workHoursStore.workHours) {
    if (validStationIds.has(wh.station_id)) {
      total += Number(wh.hours_worked) || 0
    }
  }
  return total.toFixed(1)
})

async function loadData() {
  await workHoursStore.fetchByDate(dateStr.value)
}

watch(selectedDate, () => {
  loadData()
})

onMounted(async () => {
  await stationsStore.fetchStations()
  await loadData()
  
  // Load summary for the last 30 days for chart
  const end = new Date()
  const start = subDays(end, 30)
  await workHoursStore.fetchSummary(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'))
})
</script>

<template>
  <n-layout style="min-height: 100vh; background-color: #f5f5f5;">
    <n-layout-header bordered style="padding: 16px 24px; background: white;">
      <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
        <h1 style="margin: 0; color: #18a058;">АЗС-Часы</h1>
        <router-link to="/admin/login" style="color: #666; text-decoration: none;">
          Админка
        </router-link>
      </div>
    </n-layout-header>

    <n-layout-content style="background: transparent;">
      <div class="container" style="padding-top: 32px; padding-bottom: 64px;">
        <n-space vertical size="large">
          
          <!-- Controls Row -->
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; align-items: center;">
            <DateNavigator v-model="selectedDate" />
            
            <n-radio-group v-model:value="categoryFilter" size="medium">
              <n-radio-button value="all">Все АЗС</n-radio-button>
              <n-radio-button value="city">Город и пригород</n-radio-button>
              <n-radio-button value="district">Районы</n-radio-button>
            </n-radio-group>
          </div>

          <!-- Total Indicator -->
          <n-card>
            <div style="text-align: center;">
              <n-statistic label="Интегральный показатель" :value="totalAzsHours">
                <template #suffix>
                  АЗС-часов
                </template>
              </n-statistic>
            </div>
          </n-card>

          <!-- Heatmap -->
          <n-card title="Часы работы АЗС" :segmented="{ content: true }">
            <n-spin :show="loading">
              <HoursHeatmap 
                :work-hours="workHoursStore.workHours" 
                :stations="filteredStations" 
              />
            </n-spin>
          </n-card>

          <!-- Chart -->
          <n-card title="Динамика АЗС-часов (30 дней)">
            <AzsHoursChart :data="workHoursStore.dailySummaries" />
          </n-card>
          
        </n-space>
      </div>
    </n-layout-content>
  </n-layout>
</template>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 16px;
}
</style>
