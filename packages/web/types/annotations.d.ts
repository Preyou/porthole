declare module 'virtual:ngt-annotations' {
  const config: import('@ngt/vite-plugin-annotations/client').AnnotationRuntimeConfig
  export default config
}

interface ImportMetaEnv {
  readonly NGT_ANNOTATIONS_ENABLED: boolean
}
