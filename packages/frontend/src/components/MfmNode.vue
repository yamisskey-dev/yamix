<template>
  <!-- Text node -->
  <template v-if="node.type === 'text'">{{ node.props.text }}</template>

  <!-- URL -->
  <a v-else-if="node.type === 'url'" :href="node.props.url" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
    {{ node.props.url }}
  </a>

  <!-- Bold -->
  <strong v-else-if="node.type === 'bold'">
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </strong>

  <!-- Italic -->
  <em v-else-if="node.type === 'italic'">
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </em>

  <!-- Strike -->
  <s v-else-if="node.type === 'strike'">
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </s>

  <!-- Small -->
  <small v-else-if="node.type === 'small'">
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </small>

  <!-- Quote -->
  <blockquote v-else-if="node.type === 'quote'" class="border-l-4 border-primary pl-4 my-2 text-gray-600">
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </blockquote>

  <!-- Code block -->
  <pre v-else-if="node.type === 'blockCode'" class="bg-gray-900 text-gray-100 p-4 rounded my-2 overflow-x-auto"><code>{{ node.props.code }}</code></pre>

  <!-- Inline code -->
  <code v-else-if="node.type === 'inlineCode'" class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{{ node.props.code }}</code>

  <!-- Center -->
  <div v-else-if="node.type === 'center'" class="text-center">
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </div>

  <!-- Link -->
  <a v-else-if="node.type === 'link'" :href="node.props.url" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </a>

  <!-- Mention -->
  <span v-else-if="node.type === 'mention'" class="text-primary">@{{ node.props.username }}</span>

  <!-- Hashtag -->
  <span v-else-if="node.type === 'hashtag'" class="text-primary">#{{ node.props.hashtag }}</span>

  <!-- Generic container for other nodes -->
  <span v-else>
    <MfmNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </span>
</template>

<script setup lang="ts">
import type { MfmNode as MfmNodeType } from 'mfm-js'

defineProps<{
  node: MfmNodeType
}>()
</script>
