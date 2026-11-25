# 结果码

注册表唯一来源为 src/constants/responseCodeMap.ts；语言资源与注册表保持一致。

| 名称                          | code     | HTTP |
| ----------------------------- | -------- | ---- |
| AUTH_IDENTITY_NOT_PROVISIONED | 10000014 | 403  |
| BAD_REQUEST                   | 10000400 | 400  |
| CONFLICT                      | 10000409 | 409  |
| CREATED                       | 20000001 | 201  |
| FORBIDDEN                     | 10000403 | 403  |
| INTERNAL_ERROR                | 10000000 | 500  |
| INVALID_INPUT                 | 10000422 | 422  |
| INVALID_SORT_FIELD            | 10000011 | 400  |
| INVALID_SORT_ORDER            | 10000013 | 400  |
| NOT_FOUND                     | 10000404 | 404  |
| SERVICE_UNAVAILABLE           | 10000503 | 503  |
| SORT_FIELD_REQUIRED           | 10000012 | 400  |
| SUCCESS                       | 20000000 | 200  |
| UNAUTHORIZED                  | 10000401 | 401  |
| UNKNOWN_QUERY_KEYS            | 10000010 | 400  |
