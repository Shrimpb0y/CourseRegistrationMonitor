# GitHub 选型汇总：课程选择、Launcher 与统一自动化界面

检索日期：2026-10-10。依据公开仓库 README、目录、许可标识及官方文档；本轮未下载运行候选程序，没有完成候选代码审计或 UPM 适配验证。结论中的开发难度和推荐顺序是针对当前项目的工程判断。

## 结论

推荐保留现有 Node.js + Puppeteer + UPM 适配器，以 **electron-react-boilerplate** 提供 Windows 桌面应用基础，按需采用 **shadcn/ui** 的选择器、表格与表单组件。课程与教学班数据仍须由我们从 UPM 读取并接入界面。

**UCAS-Desktop** 是本轮最接近“课程管理＋自动化＋launcher＋托盘”体验的业务项目，适合研究其操作设计。直接迁移会引入 Python/PySide6 体系、国科大专用模块及额外适配工作，当前不优先整体替换。

未在本轮搜索结果中找到已经提供这两项功能且可直接使用的 UPM e-SMP 成品。搜索没有找到不等于证明 GitHub 上不存在。

## 用户需求与边界

1. 从管理界面选择课程、组别及对应完整上课时间，保存目标，后续换课可复用。
2. 提供方便启动的本地 launcher 和统一自动化界面，减少命令行、修改 JSON 与窗口之间的操作。
3. 数据、浏览器会话及日志保存在本机；登录由用户完成。运行中不需要云服务。
4. 当前明确要求可切换课程与班级；是否同时监听多门、任意班级和优先级调度尚未确认。

## 候选比较

| 项目 | 已有能力与证据 | 对当前需求的价值 | 尚需开发或限制 | 建议 |
| --- | --- | --- | --- | --- |
| [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) | Electron、React、TypeScript、electron-vite；支持 electron-builder 打包；MIT | 桌面窗口和 Windows 安装包的基础，较易接入现有 JavaScript 后端 | 未提供课程选择与 UPM 适配；launcher 的健康检查、单实例和后台任务生命周期仍需实现；体积一般比系统 WebView 方案大 | **桌面基础首选** |
| [UCAS-Desktop](https://github.com/zhangzhendan-Berkeley/UCAS-Desktop) | 国科大桌面助手，选课规划/自动化、托盘、任务日志、Windows launcher 与便携发行说明；AGPL-3.0 | 最接近想要的整合使用体验，可研究页面组织和启动/退出语义 | 专用于国科大；引入 Python 等依赖；仓库明确部分外部选课模块没有独立 LICENSE，不能把整套代码视为统一许可 | **业务体验参考首选** |
| [fetch_lecture](https://github.com/zhjcreator/fetch_lecture) | 东南大学讲座工具，PyQt6 GUI、列表选择、实时日志、开始/停止及预约回查；MIT | 可参考“加载列表→选择目标→执行→回查”的操作路径 | 讲座预约不是 UPM 教学班选择；Python 接口需重写；其保存明文账号的做法不用于本项目 | 交互参考，非迁移首选 |
| [tauri](https://github.com/tauri-apps/tauri) | Web 前端＋Rust 后端；Windows 使用 WebView2；MIT/Apache-2.0；官方有 Node sidecar 示例 | 可制作本地桌面窗口，并通过 sidecar 保留 Node 服务 | 增加 Rust 工具链、sidecar 打包和进程通信；仍须实现全部课程选择逻辑；含 Node sidecar 后不能仅凭 Tauri 的宣传推断成品体积 | 轻量外壳备选 |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | 可修改的界面组件，MIT | 用于构建课程搜索、班级表格、配置表单及日志界面 | 组件不是业务程序，没有数据同步、监听和自动选课功能 | 与 Electron/React 搭配使用 |
| [WHUT_Courses_System](https://github.com/g10guang/WHUT_Courses_System) | 武汉理工选课工具，Tkinter 课程列表与任务页面 | 可参考目标选择和任务划分 | 学校接口不同；README 说明任务页面不会动态刷新；本次页面未确认明确的许可授权 | 不作为主框架 |

Electron 的托盘能力来自框架 API，不等于模板已经实现所需后台行为：[官方 Tray 文档](https://www.electronjs.org/docs/latest/api/tray)。Tauri 接入 Node 的依据：[官方 Node sidecar 示例](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/learn/sidecar-nodejs.mdx)。

## 推荐组合如何完成两项需求

### 课程、组别和时间选择

统一界面建议采用：登录浏览器 → 加载/搜索课程 → 选择课程 → 加载该课程的教学班 → 显示完整时间和名额 → 选择班级 → 保存目标 → 开始监听。

- 数据来自 UPM 当前会话，显示课程代码与名称，避免让用户手填学校内部 ID。
- 时间与组别联动：选择 Lecture Group 后展示其全部上课时段；例如 Group 1 同时包含周一 10–12 和周三 09，不能只保存周一时段。
- 课程性质单独确认，默认沿用 EL；Lab 信息如存在需要独立选择及校验。
- 切换目标时停止查询，避免旧任务结果覆盖新目标；保存后先做一次只读验证。
- 第一版支持单目标任意课程/班级切换与目标保存即可，多目标并行不是本次已确认要求。

上述能力需要扩展当前 UPM 适配器的课程目录与班级读取接口、配置 API 和界面；没有候选项目能直接补齐 UPM 的接口。

### Launcher 和统一界面

目标体验是双击桌面快捷方式或 EXE，即打开管理窗口；无需手动 PowerShell 和输入 localhost 地址。

- 启动时检查 Edge 和运行依赖，启动本地任务进程，等待健康检查成功再显示就绪。
- 重复打开时唤醒已有窗口，避免重复监听或端口冲突。
- 一个窗口集中展示目标选择、登录入口、监听/自动选课模式、停止、名额和错误日志。
- 建议提供托盘继续运行与明确的“退出并停止任务”；关闭窗口的行为需在实施前明确。
- 可用 Electron 内部通信连接后台任务，也可第一版保留本地 HTTP 接口。学校页面仍在专用 Edge 手动登录，桌面管理窗口负责控制。
- 本机打包运行环境，移除对 Codex 缓存目录绝对路径的依赖。日志和会话放在本机专用数据目录；运行资源打包进应用，不依赖外部 CDN 或云日志。

## 实施顺序建议与验收

1. 先拆分课程目录/教学班读取及目标配置接口，确认至少两门不同课程可以查询与切换。
2. 接入统一选择界面：课程、Group、完整时间和性质均可见；保存后重启仍能恢复选择。
3. 接入 Electron launcher：在没有全局 Node.js、没有 Codex 缓存路径的 Windows 环境完成安装、双击启动及退出验证。
4. 核实关闭窗口、托盘、重复打开、登录过期与查询失败的行为；异常须指出具体步骤。
5. 保留监听与自动注册的区别；只读功能完成后再单独验收课程添加、最终提交及注册回查。

本轮完成的是需求记录和选型研究，没有安装候选应用或修改运行中的选课逻辑。
