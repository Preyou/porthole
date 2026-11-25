/// <reference types="vite/client" />
interface ImportMetaEnv {
  // Auto generate by env-parse
  readonly VITE_SYS_API_BASE_URL: string
  readonly VITE_SYS_API_TIMEOUT: number
  /**
   * 全局通知的默认展示位置。
   */
  readonly VITE_TOAST_POSITION: string
  /**
   * 全局通知的默认自动关闭时间，单位毫秒。
   */
  readonly VITE_TOAST_DURATION_MS: number
  /**
   * 全局加载条的定位方式。
   */
  readonly VITE_LOADING_BAR_POSITION: string
  /**
   * 全局加载条显示前的延迟，单位毫秒。
   */
  readonly VITE_LOADING_BAR_DELAY_MS: number
  /**
   * 全局加载条自动走到 95% 的预期时长，单位毫秒。
   */
  readonly VITE_LOADING_BAR_DURATION_MS: number
  /**
   * 全局加载条进入结束态并走到 100% 的时长，单位毫秒。
   */
  readonly VITE_LOADING_BAR_SETTLE_DURATION_MS: number
}