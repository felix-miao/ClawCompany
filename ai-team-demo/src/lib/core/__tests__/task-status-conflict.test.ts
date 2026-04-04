import {
  TaskStatus as LibTaskStatus,
  GameTaskStatus,
  UnifiedTaskStatus,
  Task as LibTask,
  TASK_STATUS_VALUES,
  GAME_STATUS_VALUES,
  GAME_TO_LIB_STATUS,
  LIB_TO_GAME_STATUS,
  gameStatusToLib,
  libStatusToGame,
  isLibTaskStatus,
  isGameTaskStatus,
} from '../types'
import { TaskStatus as GameTaskStatusReexport } from '../../../game/types/Task'

describe('TaskStatus type conflict resolution', () => {
  it('lib TaskStatus and game TaskStatus have overlapping but different values', () => {
    const libStatuses = TASK_STATUS_VALUES
    const gameStatuses = GAME_STATUS_VALUES

    const libSet = new Set(libStatuses)
    const gameSet = new Set(gameStatuses)

    const shared = libStatuses.filter(s => gameSet.has(s as GameTaskStatus))
    const libOnly = libStatuses.filter(s => !gameSet.has(s as GameTaskStatus))
    const gameOnly = gameStatuses.filter(s => !libSet.has(s as LibTaskStatus))

    expect(shared).toEqual(['pending', 'completed', 'failed'])
    expect(libOnly).toEqual(['in_progress', 'review', 'done'])
    expect(gameOnly).toEqual(['assigned', 'working', 'reviewing'])
  })

  it('game status re-export is the same type as GameTaskStatus from lib', () => {
    const gs: GameTaskStatus = 'working'
    const gsr: GameTaskStatusReexport = gs
    expect(gsr).toBe('working')
  })
})

describe('gameStatusToLib mapping', () => {
  it('maps all game statuses to valid lib statuses', () => {
    for (const gs of GAME_STATUS_VALUES) {
      const mapped = gameStatusToLib(gs)
      expect(TASK_STATUS_VALUES).toContain(mapped)
    }
  })

  it('maps working → in_progress', () => {
    expect(gameStatusToLib('working')).toBe('in_progress')
  })

  it('maps reviewing → review', () => {
    expect(gameStatusToLib('reviewing')).toBe('review')
  })

  it('maps assigned → pending', () => {
    expect(gameStatusToLib('assigned')).toBe('pending')
  })

  it('maps shared statuses to themselves', () => {
    expect(gameStatusToLib('pending')).toBe('pending')
    expect(gameStatusToLib('completed')).toBe('completed')
    expect(gameStatusToLib('failed')).toBe('failed')
  })
})

describe('libStatusToGame mapping', () => {
  it('maps all lib statuses to valid game statuses', () => {
    for (const ls of TASK_STATUS_VALUES) {
      const mapped = libStatusToGame(ls)
      expect(GAME_STATUS_VALUES).toContain(mapped)
    }
  })

  it('maps in_progress → working', () => {
    expect(libStatusToGame('in_progress')).toBe('working')
  })

  it('maps review → reviewing', () => {
    expect(libStatusToGame('review')).toBe('reviewing')
  })

  it('maps done → completed', () => {
    expect(libStatusToGame('done')).toBe('completed')
  })

  it('maps shared statuses to themselves', () => {
    expect(libStatusToGame('pending')).toBe('pending')
    expect(libStatusToGame('completed')).toBe('completed')
    expect(libStatusToGame('failed')).toBe('failed')
  })
})

describe('UnifiedTaskStatus', () => {
  it('is a superset of both TaskStatus and GameTaskStatus', () => {
    const unified: UnifiedTaskStatus[] = [
      ...TASK_STATUS_VALUES,
      ...GAME_STATUS_VALUES,
    ]

    const unique = new Set(unified)
    expect(unique.size).toBe(9)
  })
})

describe('isLibTaskStatus / isGameTaskStatus guards', () => {
  it('isLibTaskStatus identifies lib-only statuses', () => {
    expect(isLibTaskStatus('in_progress')).toBe(true)
    expect(isLibTaskStatus('review')).toBe(true)
    expect(isLibTaskStatus('done')).toBe(true)
  })

  it('isLibTaskStatus rejects game-only statuses', () => {
    expect(isLibTaskStatus('assigned')).toBe(false)
    expect(isLibTaskStatus('working')).toBe(false)
    expect(isLibTaskStatus('reviewing')).toBe(false)
  })

  it('isGameTaskStatus identifies game-only statuses', () => {
    expect(isGameTaskStatus('assigned')).toBe(true)
    expect(isGameTaskStatus('working')).toBe(true)
    expect(isGameTaskStatus('reviewing')).toBe(true)
  })

  it('isGameTaskStatus rejects lib-only statuses', () => {
    expect(isGameTaskStatus('in_progress')).toBe(false)
    expect(isGameTaskStatus('review')).toBe(false)
    expect(isGameTaskStatus('done')).toBe(false)
  })

  it('both guards accept shared statuses', () => {
    for (const s of ['pending', 'completed', 'failed']) {
      expect(isLibTaskStatus(s)).toBe(true)
      expect(isGameTaskStatus(s)).toBe(true)
    }
  })
})

describe('Cross-module integration', () => {
  it('can convert a lib task status to game status and back via mapping', () => {
    const expectedRoundTrip: Record<LibTaskStatus, LibTaskStatus> = {
      pending: 'pending',
      in_progress: 'in_progress',
      review: 'review',
      done: 'completed',
      completed: 'completed',
      failed: 'failed',
    }

    for (const ls of TASK_STATUS_VALUES) {
      const gs = libStatusToGame(ls)
      const backToLib = gameStatusToLib(gs)
      expect(backToLib).toBe(expectedRoundTrip[ls])
    }
  })
})
