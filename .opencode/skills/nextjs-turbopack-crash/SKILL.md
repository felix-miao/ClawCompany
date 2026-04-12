---
name: nextjs-turbopack-crash
description: Diagnose and fix RangeError Map maximum size exceeded crash in Next.js dev mode caused by Turbopack HMR async iterator leak
---

## What I know

Next.js 16+ defaults to Turbopack for `next dev`. Turbopack's HMR file-watcher
uses a permanent `for await` async iterator loop in `hot-reloader-turbopack.js`.
Each iteration creates a new async context that Node.js `async_hooks` tracks in
an internal Map. This Map grows without bound until the process crashes with:

```
RangeError: Map maximum size exceeded
    at Map.set (<anonymous>)
    at AsyncHook.init (next-server/app-page-turbo.runtime.dev.js)
    at emitInitNative (node:internal/async_hooks:207)
    at createIterator.next
    at hot-reloader-turbopack.js:127:30
```

This is a **framework-level bug in Next.js/Turbopack**, not application code.

## How to confirm

Add a periodic diagnostic log (dev-only) to watch heap growth and listener counts:

```ts
// In a module that runs server-side at startup
if (process.env.NODE_ENV === 'development') {
  const diagTimer = setInterval(() => {
    const mem = process.memoryUsage()
    console.log(
      `[DIAG] heapUsed=${Math.round(mem.heapUsed/1024/1024)}MB` +
      ` activeHandles=${process._getActiveHandles?.()?.length ?? -1}`
    )
  }, 60_000)
  diagTimer.unref?.()
}
```

**Confirmed pattern:**
- `emitter.listeners` stays stable (not the leak source)
- Heap grows 2–3 GB per 60 seconds with no user activity
- Crash stacktrace always ends at `hot-reloader-turbopack.js`

## Fix

Disable Turbopack in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --no-turbo"
  }
}
```

This switches to Webpack HMR which does not have the async iterator leak.
Hot reload is slightly slower but stable for long-running dev sessions.

## Secondary hardening (not the root cause, but good hygiene)

If module-level singletons (EventEmitter, setInterval, DI containers) are
defined at module scope in Next.js Route Handlers, HMR will recreate them on
every reload while the old instances remain alive. Move them to `globalThis`
to survive HMR:

```ts
declare global { var __myInstance: MyClass | undefined }

export function getInstance(): MyClass {
  if (!globalThis.__myInstance) {
    globalThis.__myInstance = new MyClass()
  }
  return globalThis.__myInstance
}
```

Apply this pattern to: EventEmitter singletons, polling services (setInterval),
DI containers, and any stateful singleton that Route Handlers share.
