import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import antfu from '@antfu/eslint-config'
import tailwindcss from 'eslint-plugin-tailwindcss'

const appRootDir = dirname(fileURLToPath(import.meta.url))
const sourceFilePatterns = ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue}']
const maxSourceLinesRule = ['error', {
  max: 800,
  skipBlankLines: true,
  skipComments: true,
}] as const

export default antfu({
  formatters: true,
  ignores: [
    'dist/**',
    'src/api/auto/**',
    'types/auto/**',
  ],
  jsonc: true,
  rules: {
    'antfu/no-top-level-await': 'off',
    'antfu/top-level-function': 'error',
    'arrow-body-style': 'off',
    'curly': ['error', 'multi-line'],
    'eslint-comments/no-unlimited-disable': 'off',
    'func-style': 'off',
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    'no-param-reassign': 'error',
    'no-template-curly-in-string': 'off',
    'no-unlimited-disable': 'off',
    'object-shorthand': ['error', 'always'],
    'perfectionist/sort-classes': [
      'warn',
      {
        order: 'asc',
        type: 'natural',
      },
    ],
    'perfectionist/sort-objects': [
      'warn',
      {
        order: 'asc',
        type: 'natural',
      },
    ],
    'prefer-arrow-callback': 'error',
    'style/max-statements-per-line': ['error', { max: 2 }],
    'tailwindcss/no-custom-classname': 0,
  },
  settings: {
    tailwindcss: {
      cssConfigPath: resolve(appRootDir, 'src/assets/css/index.css'),
    },
  },
  vue: {
    a11y: false,
    overrides: {
      'vue/attributes-order': [
        'error',
        {
          alphabetical: false,
          order: [
            'DEFINITION',
            'LIST_RENDERING',
            'CONDITIONALS',
            'RENDER_MODIFIERS',
            'GLOBAL',
            ['UNIQUE', 'SLOT'],
            'TWO_WAY_BINDING',
            'OTHER_DIRECTIVES',
            'OTHER_ATTR',
            'EVENTS',
            'CONTENT',
          ],
        },
      ],
      'vue/component-name-in-template-casing': [
        'error',
        'PascalCase',
        {
          registeredComponentsOnly: false,
        },
      ],
      'vue/define-macros-order': [
        'error',
        {
          defineExposeLast: true,
          order: ['defineOptions', 'defineModel', 'defineProps', 'defineEmits', 'defineSlots'],
        },
      ],
      'vue/max-attributes-per-line': [
        'error',
        {
          multiline: {
            max: 1,
          },
          singleline: {
            max: 3,
          },
        },
      ],
      'vue/multiline-html-element-content-newline': [
        'error',
        {
          allowEmptyLines: false,
          ignoreWhenEmpty: true,
        },
      ],
    },
  },
}).append({
  files: sourceFilePatterns,
  rules: {
    'max-lines': maxSourceLinesRule,
  },
}).append({
  plugins: {
    tailwindcss,
  },
  rules: {
    'tailwindcss/no-arbitrary-value': 'error',
  },
  settings: {
    tailwindcss: {
      cssConfigPath: resolve(appRootDir, 'src/assets/css/index.css'),
    },
  },
})
