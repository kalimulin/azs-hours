<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NDatePicker } from 'naive-ui'
import { addDays, subDays } from 'date-fns'

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const dateValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

function prevDay() {
  dateValue.value = subDays(dateValue.value, 1).getTime()
}

function nextDay() {
  dateValue.value = addDays(dateValue.value, 1).getTime()
}
</script>

<template>
  <div style="display: flex; align-items: center; gap: 8px;">
    <n-button @click="prevDay">← Пред</n-button>
    <n-date-picker 
      v-model:value="dateValue" 
      type="date" 
      :clearable="false"
      style="width: 160px;"
    />
    <n-button @click="nextDay">След →</n-button>
  </div>
</template>
