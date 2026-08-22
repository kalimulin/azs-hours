<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import { ruRU, dateRuRU } from 'naive-ui'
</script>

<template>
  <n-config-provider :locale="ruRU" :date-locale="dateRuRU">
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
