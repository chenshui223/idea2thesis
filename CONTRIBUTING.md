# Contributing to idea2thesis

感谢你关注 `idea2thesis`。

这个项目当前是一个本地单用户、多 Agent、面向毕业设计/论文场景的开源 Web 应用。贡献时请优先保持这几个边界：

- 本地部署优先，不做托管 SaaS 假设
- `API Key` 不持久化
- 生成结果默认写入本机 `jobs/`
- 功能改动尽量保持可验证、可回归、可本地运行

## 开发环境

建议环境：

- Python `3.12+`
- Node.js `20+`

初始化依赖：

```bash
git clone https://github.com/chenshui223/idea2thesis.git
cd idea2thesis
bash scripts/bootstrap.sh
```

启动本地开发环境：

```bash
bash scripts/dev.sh
```

只检查环境：

```bash
bash scripts/dev.sh --check
```

## 常用命令

前端测试：

```bash
cd frontend
npm test -- --run
```

前端构建：

```bash
cd frontend
npm run build
```

后端测试：

```bash
cd /path/to/idea2thesis
pytest
```

## 提交前最少检查

在提交或发 PR 前，至少跑这些命令：

```bash
cd /path/to/idea2thesis
pytest
cd frontend && npm test -- --run
cd frontend && npm run build
cd .. && bash scripts/dev.sh --check
```

如果你只改了文档，至少确认：

```bash
git diff --stat
git status --short
```

## 代码与文档原则

请尽量遵守这些约束：

- 不提交本地运行产物
- 不提交真实 `API Key`
- 不把 `jobs/`、`.idea2thesis/`、`.env` 之类本地状态加入版本库
- 不随意改动已经通过验证的执行链路语义
- 不把“可能可用”的状态写成“已经完成”
- 文档优先写清楚本地部署方式和实际边界

前端改动请注意：

- 当前默认语言是中文
- 右上角支持一键切换英文
- 新增可见文案时，尽量同步补中英两套

## 提交建议

推荐小步提交，信息清楚：

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `chore: ...`
- `test: ...`

如果改动较大，建议拆成：

- 基础重构
- 行为变更
- 测试补充
- 文档更新

## 关于 Issue 和 PR

欢迎提交：

- bug 修复
- 可验证的功能增强
- 本地部署体验改进
- 文档完善
- 测试覆盖补充

提交 PR 时，建议写清楚：

- 改了什么
- 为什么要改
- 如何验证
- 是否影响已有工作流
- 是否涉及 UI 文案变化

## 安全提醒

请不要提交这些内容：

- 真实 `API Key`
- 本地生成的 `jobs/`
- `.idea2thesis/` 下的运行状态
- 你自己临时导出的敏感文件

提交前建议执行：

```bash
git status --short
```

只在确认待提交内容都是源码、测试或文档时再推送。

## License

本仓库当前使用 [Apache License 2.0](LICENSE)。

默认情况下，你提交到本仓库的贡献将按仓库现有许可证分发。
