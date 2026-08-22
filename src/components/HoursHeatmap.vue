<script setup lang="ts">
import { computed } from 'vue'
import type { WorkHourWithStation, Station } from '@/types'

const props = defineProps<{
  workHours: any[] // WorkHour array from db
  stations: Station[] // Filtered stations to display
}>()

const hours = Array.from({ length: 24 }, (_, i) => i)

// Map workHours by station_id for quick access
const workHoursMap = computed(() => {
  const map = new Map()
  for (const wh of props.workHours) {
    map.set(wh.station_id, wh)
  }
  return map
})

function getHourState(stationId: string, hour: number): 'past' | 'future' | 'inactive' {
  const wh = workHoursMap.value.get(stationId)
  if (!wh || !wh.is_working || !wh.start_time || !wh.end_time) return 'inactive'

  const startHour = parseInt(wh.start_time.split(':')[0], 10)
  const endHour = parseInt(wh.end_time.split(':')[0], 10)

  let isActive = false
  if (startHour === endHour) {
    isActive = true
  } else if (endHour > startHour) {
    isActive = hour >= startHour && hour < endHour
  } else {
    isActive = hour >= startHour || hour < endHour
  }
  
  if (!isActive) return 'inactive'
  
  // Check if the date is today
  const isToday = wh.date === new Date().toISOString().split('T')[0]
  const currentHour = new Date().getHours()
  
  if (isToday) {
    return hour < currentHour ? 'past' : 'future'
  } else {
    // If it's a past date, all hours are 'past'
    // If it's a future date, all hours are 'future'
    const whDate = new Date(wh.date)
    const todayDate = new Date()
    todayDate.setHours(0,0,0,0)
    
    return whDate < todayDate ? 'past' : 'future'
  }
}

function getStationTotal(stationId: string): string {
  const wh = workHoursMap.value.get(stationId)
  if (!wh || !wh.is_working) return '0'
  return Number(wh.hours_worked).toFixed(1)
}

const columnTotals = computed(() => {
  const totals = new Array(24).fill(0)
  for (const h of hours) {
    for (const s of props.stations) {
      if (getHourState(s.id, h) !== 'inactive') {
        totals[h]++
      }
    }
  }
  return totals
})

const grandTotal = computed(() => {
  let total = 0
  for (const s of props.stations) {
    total += Number(getStationTotal(s.id))
  }
  return total.toFixed(1)
})
</script>

<template>
  <div class="heatmap-container">
    <table class="heatmap-table">
      <thead>
        <tr>
          <th class="station-col">АЗС</th>
          <th v-for="h in hours" :key="h" class="hour-col">{{ h }}</th>
          <th class="total-col">Итого</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="station in stations" :key="station.id">
          <td class="station-col name-cell">
            <span class="brand-tag" :class="station.brand === 'Лукойл' ? 'brand-luk' : (station.brand === 'Газпром' ? 'brand-gaz' : '')">
              {{ station.brand[0] }}
            </span>
            <span>№{{ station.station_number }}</span>
          </td>
          <td 
            v-for="h in hours" 
            :key="h" 
            class="hour-cell"
            :class="[getHourState(station.id, h)]"
            :title="`${station.brand} №${station.station_number} - ${h}:00`"
          ></td>
          <td class="total-cell fw-bold">{{ getStationTotal(station.id) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th class="station-col text-right">Работающих АЗС:</th>
          <th v-for="(t, i) in columnTotals" :key="i" class="hour-col text-center">
            {{ t || '-' }}
          </th>
          <th class="total-col">{{ grandTotal }}</th>
        </tr>
      </tfoot>
    </table>
    <div v-if="stations.length === 0" class="empty-state">
      Нет данных для отображения
    </div>
  </div>
</template>

<style scoped>
.heatmap-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #efeff5;
}

.heatmap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.heatmap-table th, .heatmap-table td {
  border: 1px solid #efeff5;
  padding: 4px 8px;
}

.heatmap-table th {
  background-color: #fafafc;
  font-weight: 600;
  color: #333639;
  text-align: center;
}

.station-col {
  min-width: 140px;
  text-align: left !important;
  background-color: #fff;
  position: sticky;
  left: 0;
  z-index: 1;
}

.heatmap-table th.station-col {
  background-color: #fafafc;
  z-index: 2;
}

.hour-col {
  width: 32px;
  min-width: 32px;
}

.total-col {
  width: 60px;
  background-color: #fafafc;
  text-align: center;
}

.total-cell {
  background-color: #fafafc;
  text-align: center;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.hour-cell {
  background-color: #f3f4f6; /* inactive */
  transition: background-color 0.2s;
}

.hour-cell.past {
  background-color: #18a058; /* Darker green for passed hours */
}

.hour-cell.future {
  background-color: #a3e6b5; /* Lighter green for future hours */
}

.brand-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: white;
  font-weight: bold;
  font-size: 11px;
  background-color: #999;
}

.brand-luk { background-color: #e53935; } /* Red */
.brand-gaz { background-color: #1e88e5; } /* Blue */

.text-right { text-align: right !important; }
.text-center { text-align: center !important; }
.fw-bold { font-weight: bold; }

.empty-state {
  padding: 32px;
  text-align: center;
  color: #999;
}
</style>
