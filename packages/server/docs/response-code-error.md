# ResponseCodeError

统一业务失败使用注册过的失败码，HTTP 状态从结果码注册表映射；诊断 message 不作为用户提示。未知技术错误保留失败并交给统一错误边界。

```ts
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { ResponseCodeError } from '@/errors/responseCode'

throw new ResponseCodeError(RESPONSE_CODES.FORBIDDEN)
```

不要为普通业务状态机械创建异常；只有被设计为失败的输入、认证、授权和技术边界进入错误路径。成功通过 format 返回。
