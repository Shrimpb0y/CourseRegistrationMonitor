# GitHub Selection Report: Courses, Launcher, and Integrated Automation UI

Research date: 2026-10-10 · English edition: 2026-10-13

The source research used public README files, repository contents, license identifiers, and official documentation. Candidate programs were not downloaded or run, and their code was not audited or validated against UPM. Development difficulty and ordering are engineering judgments for this project. This English edition translates those dated findings; it does not perform a new search or update current project capabilities or licenses.

## Conclusion

Retain the existing Node.js + Puppeteer + UPM adapter. Use **electron-react-boilerplate** as a prospective Windows desktop foundation and optionally **shadcn/ui** for selectors, tables, and forms. Course and group data must still be read from UPM and integrated by this project.

**UCAS-Desktop** was the closest business-application reference for course management, automation, launcher, and tray integration. Its page organization and lifecycle semantics are worth studying. Migrating it wholesale would introduce Python/PySide6, UCAS-specific modules, and additional adaptation work, so it was not the preferred migration path.

The search did not find a ready-to-use UPM e-SMP product providing both requested capabilities. Failure to find one does not prove that none exists on GitHub.

## User requirements and boundaries

1. Select courses, groups, and corresponding complete schedules through the management UI, save targets, and reuse the flow when changing courses.
2. Provide convenient local startup and an integrated automation interface, reducing command-line, manual JSON, and multi-window work.
3. Keep data, browser sessions, and logs local, with login performed by the user. Runtime operation should not require cloud services.
4. Switching courses/groups is confirmed. Simultaneous multi-course monitoring, any-group selection, and priority scheduling were not confirmed in this research round.

## Candidate comparison

| Project | Capabilities/evidence recorded in the source research | Value for this project | Development still needed or limitations | Recommendation |
| --- | --- | --- | --- | --- |
| [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) | Electron, React, TypeScript, electron-vite, electron-builder packaging; MIT | Desktop window and Windows installer foundation; relatively straightforward integration with the JavaScript backend | No course selector or UPM adapter; health checks, single-instance behavior, and background lifecycle need implementation; usually larger than a system-WebView shell | Preferred desktop foundation |
| [UCAS-Desktop](https://github.com/zhangzhendan-Berkeley/UCAS-Desktop) | UCAS assistant with course planning/automation, tray, task logs, Windows launcher, portable-release instructions; AGPL-3.0 | Closest integrated usage experience; useful page/lifecycle reference | UCAS-specific; Python and other dependencies; repository notes that some external course modules lack a separate LICENSE, so the entire code set cannot be assumed to have one uniform license | Preferred business-interaction reference |
| [fetch_lecture](https://github.com/zhjcreator/fetch_lecture) | Southeast University lecture tool; PyQt6 GUI, list selection, live logs, start/stop, reservation verification; MIT | Reference for load list → choose target → run → verify | Lecture reservation differs from UPM teaching-group selection; Python interfaces need replacement; plaintext-account storage is not adopted here | Interaction reference, not the preferred migration base |
| [tauri](https://github.com/tauri-apps/tauri) | Web frontend + Rust backend; Windows WebView2; MIT/Apache-2.0; official Node sidecar example | Local desktop shell while retaining the Node service through a sidecar | Adds Rust tooling, sidecar packaging, and process communication; all course-selection logic still custom; a Node sidecar prevents inferring final package size from Tauri marketing alone | Alternative desktop shell |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Modifiable UI components; MIT | Course search, group tables, configuration forms, and logs | Components are not a business application; no synchronization, monitoring, or registration logic | Optional companion to Electron/React |
| [WHUT_Courses_System](https://github.com/g10guang/WHUT_Courses_System) | Wuhan University of Technology course tool; Tkinter course-list/task pages | Target selection and task organization reference | Different school interfaces; README says task page does not refresh dynamically; clear license authorization was not confirmed during the source review | Not recommended as the primary framework |

Electron's tray support comes from its API, not proof that a template implements the required background behavior: [official Tray documentation](https://www.electronjs.org/docs/latest/api/tray). The basis for retaining Node in Tauri is the [official Node sidecar example](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/learn/sidecar-nodejs.mdx).

## How the proposed combination meets the requirements

### Course, group, and time selection

Proposed flow: open login browser → load/search courses → choose a course → load that course's groups → display complete schedules and availability → choose a group → save the target → monitor.

- Read data from the current UPM session and show course code/name instead of asking the user to enter internal school IDs.
- Link the group to every time slot. Group 1 includes Monday 10–12 and Wednesday 09; saving only Monday would lose part of the target.
- Confirm the category separately, defaulting to EL. If Lab information exists, select and validate it independently.
- Stop queries during target changes so an old task cannot overwrite new state. Perform a read-only validation after saving.
- The first phase needs one saved target with course/group switching. Multi-target concurrency was not a confirmed requirement for that phase.

This requires extending the UPM adapter's directory/group readers, configuration APIs, and interface. None of the candidates directly supplies the UPM integration.

### Launcher and integrated interface

The desired experience is a desktop shortcut or EXE opening the management window directly, without manually starting PowerShell or entering a localhost address.

- Check Edge and dependencies, start the local task process, and wait for a successful health check before reporting readiness.
- Bring an existing window forward on repeated launch rather than creating duplicate monitoring or port conflicts.
- Put target selection, login entry, monitor/automatic modes, stop, availability, and error logs in one window.
- Consider tray continuation and a clear exit-and-stop action. Decide window-close behavior before implementation.
- Electron IPC can connect the background tasks, or the first desktop version can retain local HTTP. The school session still runs in dedicated Edge with manual login; the desktop window controls it.
- Bundle the runtime to remove dependence on an absolute Codex-cache path. Keep logs/sessions in a dedicated local data directory and package assets locally, without a CDN or cloud logging dependency.

## Suggested implementation order and acceptance

1. Separate directory/group reading and target-configuration interfaces; verify querying and switching between at least two courses.
2. Connect the selector: visible course, group, complete time, and category; selection persists after restart.
3. Add an Electron launcher; validate installation, double-click startup, and exit on Windows without a global Node.js or Codex-cache runtime.
4. Verify window closure, tray behavior, repeated launch, expired login, and query failures; report the failing step explicitly.
5. Preserve the distinction between monitoring and automatic registration. Validate read-only features first, then separately validate adding, final submission, and registered-list verification.

The research round itself delivered requirements and selection findings only. It did not install candidate applications or change running course-monitor logic. The later selector implementation and real acceptance are recorded in [DISCUSSION-AND-IMPROVEMENTS.md](DISCUSSION-AND-IMPROVEMENTS.md).
