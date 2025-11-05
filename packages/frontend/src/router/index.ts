import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../pages/HomePage.vue'),
  },
  {
    path: '/posts/:id',
    name: 'post-detail',
    component: () => import('../pages/PostDetailPage.vue'),
  },
  {
    path: '/posts/new',
    name: 'post-create',
    component: () => import('../pages/PostCreatePage.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue'),
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../pages/RegisterPage.vue'),
  },
  {
    path: '/category/:slug',
    name: 'category',
    component: () => import('../pages/CategoryPage.vue'),
  },
  {
    path: '/tag/:slug',
    name: 'tag',
    component: () => import('../pages/TagPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
})

export default router
