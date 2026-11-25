# 文档与验证

文档先于代码。生成类型和文档投影禁止手改。只格式化变更文件：`bunx --bun eslint <文件路径...> --fix`。提交前运行 `bun run docs:check`、`bun run generate`、`bun run check`、`bun run build`。浏览器验证区分受控 API、真实认证与实际后端联调。
