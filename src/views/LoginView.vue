<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { NCard, NSpace, NInput, NButton, NAlert, NSpin } from 'naive-ui'

const email = ref('')
const password = ref('')
const authStore = useAuthStore()
const router = useRouter()

async function handleLogin() {
  try {
    await authStore.signIn(email.value, password.value)
    router.push({ name: 'admin' })
  } catch (e) {
    // Error is handled in the store and exposed via authStore.error
  }
}
</script>

<template>
  <div class="login-container">
    <n-card title="Вход в админку" style="max-width: 400px; margin: 0 auto; margin-top: 100px;">
      <n-spin :show="authStore.loading">
        <n-space vertical size="large">
          <n-alert v-if="authStore.error" type="error" :show-icon="true">
            {{ authStore.error }}
          </n-alert>
          <n-input
            v-model:value="email"
            type="text"
            placeholder="Email"
            @keyup.enter="handleLogin"
          />
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="Пароль"
            @keyup.enter="handleLogin"
          />
          <n-button type="primary" block @click="handleLogin" :loading="authStore.loading">
            Войти
          </n-button>
          
          <div style="text-align: center; margin-top: 10px;">
            <router-link to="/">Вернуться на главную</router-link>
          </div>
        </n-space>
      </n-spin>
    </n-card>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  padding: 20px;
  background-color: #f5f5f5;
}
</style>
