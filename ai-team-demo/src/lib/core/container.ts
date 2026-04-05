export type ServiceToken = string | symbol

type Factory<T> = (container: Container) => T

interface ServiceDescriptor<T = unknown> {
  factory: Factory<T>
  instance?: T
  singleton: boolean
  initialized: boolean
}

export class Container {
  private services = new Map<ServiceToken, ServiceDescriptor>()
  private resolving = new Set<ServiceToken>()

  register<T>(token: ServiceToken, factory: Factory<T>, singleton: boolean = true): void {
    this.services.set(token, {
      factory,
      singleton,
      initialized: false,
    })
  }

  registerInstance<T>(token: ServiceToken, instance: T): void {
    this.services.set(token, {
      factory: () => instance,
      instance,
      singleton: true,
      initialized: true,
    })
  }

  resolve<T>(token: ServiceToken): T {
    const descriptor = this.services.get(token)
    if (!descriptor) {
      throw new Error(`Service not registered: ${String(token)}`)
    }

    if (!descriptor.singleton) {
      return descriptor.factory(this) as T
    }

    if (descriptor.initialized && descriptor.instance !== undefined) {
      return descriptor.instance as T
    }

    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${String(token)}`)
    }

    this.resolving.add(token)
    try {
      descriptor.instance = descriptor.factory(this)
      descriptor.initialized = true
      return descriptor.instance as T
    } finally {
      this.resolving.delete(token)
    }
  }

  tryResolve<T>(token: ServiceToken): T | undefined {
    const descriptor = this.services.get(token)
    if (!descriptor) return undefined

    try {
      return this.resolve<T>(token)
    } catch {
      return undefined
    }
  }

  has(token: ServiceToken): boolean {
    return this.services.has(token)
  }

  reset(token: ServiceToken): void {
    const descriptor = this.services.get(token)
    if (descriptor) {
      descriptor.instance = undefined
      descriptor.initialized = false
    }
  }

  resetAll(): void {
    for (const [token] of this.services) {
      this.reset(token)
    }
  }

  createScope(): ScopedContainer {
    return new ScopedContainer(this)
  }
}

export class ScopedContainer {
  private parent: Container
  private overrides = new Map<ServiceToken, unknown>()

  constructor(parent: Container) {
    this.parent = parent
  }

  override<T>(token: ServiceToken, instance: T): void {
    this.overrides.set(token, instance)
  }

  resolve<T>(token: ServiceToken): T {
    if (this.overrides.has(token)) {
      return this.overrides.get(token) as T
    }
    return this.parent.resolve<T>(token)
  }

  tryResolve<T>(token: ServiceToken): T | undefined {
    if (this.overrides.has(token)) {
      return this.overrides.get(token) as T
    }
    return this.parent.tryResolve<T>(token)
  }
}
