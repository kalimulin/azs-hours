import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { WorkHourWithStation, DailySummary, WorkHourEntry } from '@/types'
import { format } from 'date-fns'

export const useWorkHoursStore = defineStore('workHours', () => {
  const workHours = ref<WorkHourWithStation[]>([])
  const dailySummaries = ref<DailySummary[]>([])
  const loading = ref(false)

  async function fetchByDate(date: string) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('work_hours')
        .select('*, station:stations(*)')
        .eq('date', date)
      if (error) throw error
      workHours.value = data as WorkHourWithStation[]
    } catch (e) {
      console.error('Failed to fetch work hours by date:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchSummary(startDate: string, endDate: string) {
    loading.value = true
    try {
      // Aggregate query manually or via view.
      // Doing it directly might require a view in supabase, but we can also fetch all and group on client
      // or use rpc. For simplicity here, we fetch the range and group on client if rpc is not available.
      const { data, error } = await supabase
        .from('work_hours')
        .select('date, hours_worked')
        .gte('date', startDate)
        .lte('date', endDate)

      if (error) throw error

      // Group by date
      const summaryMap: Record<string, number> = {}
      for (const row of data) {
        if (!summaryMap[row.date]) {
          summaryMap[row.date] = 0
        }
        summaryMap[row.date] += Number(row.hours_worked) || 0
      }

      // Convert to array and sort
      const sortedSummaries = Object.keys(summaryMap)
        .sort()
        .map(date => ({
          date,
          total_azs_hours: summaryMap[date]
        }))

      dailySummaries.value = sortedSummaries
    } catch (e) {
      console.error('Failed to fetch summary:', e)
    } finally {
      loading.value = false
    }
  }

  async function upsertWorkHours(date: string, entries: WorkHourEntry[]) {
    loading.value = true
    try {
      const payload = entries.map((entry) => ({
        station_id: entry.station_id,
        date,
        is_working: entry.is_working,
        start_time: entry.start_time,
        end_time: entry.end_time,
      }))
      const { error } = await supabase.from('work_hours').upsert(payload, { onConflict: 'station_id,date' })
      if (error) throw error
      
      // Refresh local data
      await fetchByDate(date)
    } catch (e) {
      console.error('Failed to upsert work hours:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    workHours,
    dailySummaries,
    loading,
    fetchByDate,
    fetchSummary,
    upsertWorkHours,
  }
})
