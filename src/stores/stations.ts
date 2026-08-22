import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Station } from '@/types'

export const useStationsStore = defineStore('stations', () => {
  const stations = ref<Station[]>([])
  const loading = ref(false)

  async function fetchStations() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .order('brand')
        .order('station_number')
      if (error) throw error
      stations.value = data as Station[]
    } catch (e) {
      console.error('Failed to fetch stations:', e)
    } finally {
      loading.value = false
    }
  }

  async function addStation(station: Omit<Station, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('stations')
      .insert([station])
      .select()
      .single()
    if (error) throw error
    stations.value.push(data as Station)
    return data
  }

  async function updateStation(id: string, updates: Partial<Station>) {
    const { data, error } = await supabase
      .from('stations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const index = stations.value.findIndex((s) => s.id === id)
    if (index !== -1) {
      stations.value[index] = data as Station
    }
    return data
  }

  async function deleteStation(id: string) {
    const { error } = await supabase.from('stations').delete().eq('id', id)
    if (error) throw error
    stations.value = stations.value.filter((s) => s.id !== id)
  }

  async function parseToday() {
    const { data, error } = await supabase.functions.invoke('parse-azs', {
      method: 'POST'
    })
    if (error) throw error
    await fetchStations()
    return data
  }

  return {
    stations,
    loading,
    fetchStations,
    addStation,
    updateStation,
    deleteStation,
    parseToday,
  }
})
