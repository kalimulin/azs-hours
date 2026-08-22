<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { 
  NLayout, NLayoutHeader, NLayoutContent, NSpace, NButton, 
  NTabs, NTabPane, NCard, NDataTable, NModal, NForm, NFormItem, 
  NInput, NSelect, NDatePicker, NTimePicker, NCheckbox, NIcon, NTag, NInputNumber
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { useStationsStore } from '@/stores/stations'
import { useWorkHoursStore } from '@/stores/workHours'
import { format, parse } from 'date-fns'
import type { Station, WorkHourEntry } from '@/types'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const authStore = useAuthStore()
const stationsStore = useStationsStore()
const workHoursStore = useWorkHoursStore()

// State
const parsing = ref(false)
const selectedDate = ref(Date.now())

// Modals
const showStationModal = ref(false)
const editingStationId = ref<string | null>(null)
const stationForm = ref({
  station_number: '',
  brand: 'Лукойл',
  address: '',
  category: 'city',
  lat: null as number | null,
  lon: null as number | null,
  fuel_types: [] as string[]
})

// Brand and Category Options
const brandOptions = [
  { label: 'Лукойл', value: 'Лукойл' },
  { label: 'Газпром', value: 'Газпром' },
  { label: 'Другая', value: 'Другая' }
]

const categoryOptions = [
  { label: 'Город и пригород', value: 'city' },
  { label: 'Районы', value: 'district' }
]

const fuelOptions = [
  { label: '92', value: '92' },
  { label: '95', value: '95' },
  { label: 'ДТ', value: 'ДТ' },
  { label: 'Газ', value: 'Газ' }
]

// --- Actions ---

async function handleLogout() {
  await authStore.signOut()
  router.push({ name: 'home' })
}

async function handleParseToday() {
  parsing.value = true
  try {
    const result = await stationsStore.parseToday()
    message.success(`Парсинг завершен! Обработано АЗС: ${result.total_parsed}`)
    await loadWorkHoursForDate(selectedDate.value)
  } catch (e: any) {
    message.error(`Ошибка парсинга: ${e.message}`)
  } finally {
    parsing.value = false
  }
}

// --- Stations Management ---

const stationColumns = [
  { title: 'Бренд', key: 'brand' },
  { title: 'Номер', key: 'station_number' },
  { title: 'Адрес', key: 'address' },
  { 
    title: 'Категория', 
    key: 'category',
    render(row: Station) {
      return row.category === 'city' ? 'Город' : 'Район'
    }
  },
  {
    title: 'Топливо',
    key: 'fuel_types',
    render(row: Station) {
      return row.fuel_types.map(f => h(NTag, { style: 'margin-right: 4px', size: 'small' }, { default: () => f }))
    }
  },
  {
    title: 'Действия',
    key: 'actions',
    render(row: Station) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => editStation(row) }, { default: () => 'Ред.' }),
          h(NButton, { size: 'small', type: 'error', onClick: () => confirmDeleteStation(row) }, { default: () => 'Удалить' })
        ]
      })
    }
  }
]

function openAddStation() {
  editingStationId.value = null
  stationForm.value = {
    station_number: '',
    brand: 'Лукойл',
    address: '',
    category: 'city',
    lat: null,
    lon: null,
    fuel_types: []
  }
  showStationModal.value = true
}

function editStation(station: Station) {
  editingStationId.value = station.id
  stationForm.value = {
    station_number: station.station_number,
    brand: station.brand,
    address: station.address,
    category: station.category,
    lat: station.lat,
    lon: station.lon,
    fuel_types: [...station.fuel_types]
  }
  showStationModal.value = true
}

async function saveStation() {
  try {
    if (editingStationId.value) {
      await stationsStore.updateStation(editingStationId.value, stationForm.value as any)
      message.success('АЗС обновлена')
    } else {
      await stationsStore.addStation(stationForm.value as any)
      message.success('АЗС добавлена')
    }
    showStationModal.value = false
  } catch (e: any) {
    message.error(`Ошибка: ${e.message}`)
  }
}

function confirmDeleteStation(station: Station) {
  dialog.warning({
    title: 'Удаление АЗС',
    content: `Удалить АЗС №${station.station_number}?`,
    positiveText: 'Удалить',
    negativeText: 'Отмена',
    onPositiveClick: async () => {
      try {
        await stationsStore.deleteStation(station.id)
        message.success('АЗС удалена')
      } catch (e: any) {
        message.error(`Ошибка: ${e.message}`)
      }
    }
  })
}

// --- Work Hours Management ---

interface EditableWorkHour {
  station_id: string
  station_name: string
  is_working: boolean
  start_time: number | null
  end_time: number | null
}

const editableWorkHours = ref<EditableWorkHour[]>([])

function timeStringToTimestamp(timeStr: string | null): number | null {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':')
  const date = new Date()
  date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
  return date.getTime()
}

function timestampToTimeString(timestamp: number | null): string | null {
  if (!timestamp) return null
  return format(timestamp, 'HH:mm')
}

async function loadWorkHoursForDate(timestamp: number) {
  const dateStr = format(timestamp, 'yyyy-MM-dd')
  await workHoursStore.fetchByDate(dateStr)
  
  // Initialize editable list with all stations
  editableWorkHours.value = stationsStore.stations.map(station => {
    const existing = workHoursStore.workHours.find(wh => wh.station_id === station.id)
    return {
      station_id: station.id,
      station_name: `${station.brand} №${station.station_number} (${station.address})`,
      is_working: existing ? existing.is_working : false,
      start_time: existing ? timeStringToTimestamp(existing.start_time) : null,
      end_time: existing ? timeStringToTimestamp(existing.end_time) : null
    }
  })
}

async function saveWorkHours() {
  const dateStr = format(selectedDate.value, 'yyyy-MM-dd')
  const entries: WorkHourEntry[] = editableWorkHours.value.map(ewh => ({
    station_id: ewh.station_id,
    is_working: ewh.is_working,
    start_time: timestampToTimeString(ewh.start_time),
    end_time: timestampToTimeString(ewh.end_time)
  }))
  
  try {
    await workHoursStore.upsertWorkHours(dateStr, entries)
    message.success('Часы работы сохранены')
  } catch (e: any) {
    message.error(`Ошибка сохранения: ${e.message}`)
  }
}

const workHourColumns = [
  { title: 'АЗС', key: 'station_name' },
  { 
    title: 'Работала', 
    key: 'is_working',
    render(row: EditableWorkHour) {
      return h(NCheckbox, {
        checked: row.is_working,
        'onUpdate:checked': (val: boolean) => { row.is_working = val }
      })
    }
  },
  {
    title: 'Начало',
    key: 'start_time',
    render(row: EditableWorkHour) {
      return h(NTimePicker, {
        value: row.start_time,
        format: 'HH:mm',
        'onUpdate:value': (val: number | null) => { row.start_time = val },
        disabled: !row.is_working
      })
    }
  },
  {
    title: 'Конец',
    key: 'end_time',
    render(row: EditableWorkHour) {
      return h(NTimePicker, {
        value: row.end_time,
        format: 'HH:mm',
        'onUpdate:value': (val: number | null) => { row.end_time = val },
        disabled: !row.is_working
      })
    }
  }
]

onMounted(async () => {
  await stationsStore.fetchStations()
  await loadWorkHoursForDate(selectedDate.value)
})
</script>

<template>
  <n-layout style="min-height: 100vh">
    <n-layout-header bordered style="padding: 16px 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto;">
        <h2 style="margin: 0">Админка АЗС-Часы</h2>
        <n-space>
          <router-link to="/">
            <n-button>На главную</n-button>
          </router-link>
          <n-button type="error" ghost @click="handleLogout">Выйти</n-button>
        </n-space>
      </div>
    </n-layout-header>

    <n-layout-content style="padding: 24px; max-width: 1400px; margin: 0 auto;">
      <n-tabs type="line" animated>
        <!-- Tab 1: Парсинг -->
        <n-tab-pane name="parsing" tab="Парсинг сайта">
          <n-card>
            <n-space vertical>
              <p>Из-за геоблокировок парсинг сайта azs.astrobl.ru выполняется локально с вашего компьютера.</p>
              <p>Для обновления данных откройте терминал и выполните команду: <b>npm run parse</b></p>
              <p>После выполнения скрипта обновите страницу, чтобы увидеть новые данные.</p>
            </n-space>
          </n-card>
        </n-tab-pane>

        <!-- Tab 2: Ручной ввод -->
        <n-tab-pane name="manual" tab="Ручной ввод часов работы">
          <n-card>
            <n-space vertical size="large">
              <div style="display: flex; align-items: center; gap: 16px;">
                <span style="font-weight: bold;">Выберите дату:</span>
                <n-date-picker 
                  v-model:value="selectedDate" 
                  type="date" 
                  :clearable="false"
                  @update:value="loadWorkHoursForDate" 
                />
              </div>
              
              <n-data-table
                :columns="workHourColumns"
                :data="editableWorkHours"
                :loading="workHoursStore.loading"
                :max-height="500"
                virtual-scroll
              />
              
              <n-button type="primary" size="large" @click="saveWorkHours" :loading="workHoursStore.loading">
                Сохранить часы работы
              </n-button>
            </n-space>
          </n-card>
        </n-tab-pane>

        <!-- Tab 3: Справочник АЗС -->
        <n-tab-pane name="stations" tab="Справочник АЗС">
          <n-card>
            <n-space vertical size="large">
              <div style="display: flex; justify-content: flex-end;">
                <n-button type="primary" @click="openAddStation">Добавить АЗС</n-button>
              </div>
              
              <n-data-table
                :columns="stationColumns"
                :data="stationsStore.stations"
                :loading="stationsStore.loading"
                :max-height="600"
                virtual-scroll
              />
            </n-space>
          </n-card>
        </n-tab-pane>
      </n-tabs>
    </n-layout-content>

    <!-- Modal for Station Edit/Add -->
    <n-modal v-model:show="showStationModal" preset="card" title="АЗС" style="width: 600px">
      <n-form :model="stationForm" label-placement="left" label-width="120">
        <n-form-item label="Номер АЗС" path="station_number">
          <n-input v-model:value="stationForm.station_number" placeholder="Например: 36" />
        </n-form-item>
        
        <n-form-item label="Бренд" path="brand">
          <n-select v-model:value="stationForm.brand" :options="brandOptions" />
        </n-form-item>
        
        <n-form-item label="Адрес" path="address">
          <n-input v-model:value="stationForm.address" placeholder="Адрес АЗС" />
        </n-form-item>
        
        <n-form-item label="Категория" path="category">
          <n-select v-model:value="stationForm.category" :options="categoryOptions" />
        </n-form-item>
        
        <n-form-item label="Виды топлива" path="fuel_types">
          <n-select v-model:value="stationForm.fuel_types" multiple :options="fuelOptions" />
        </n-form-item>
        
        <n-form-item label="Широта (Lat)" path="lat">
          <n-input-number v-model:value="stationForm.lat" placeholder="46.xxx" clearable />
        </n-form-item>
        
        <n-form-item label="Долгота (Lon)" path="lon">
          <n-input-number v-model:value="stationForm.lon" placeholder="48.xxx" clearable />
        </n-form-item>
      </n-form>
      
      <template #footer>
        <n-space justify="end">
          <n-button @click="showStationModal = false">Отмена</n-button>
          <n-button type="primary" @click="saveStation">Сохранить</n-button>
        </n-space>
      </template>
    </n-modal>
  </n-layout>
</template>
