'use client';

import { useState, useCallback } from 'react';
import { GameEvent } from '@/game/types/GameEvents';

const AGENTS = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'charlie', name: 'Charlie' },
  { id: 'diana', name: 'Diana' },
];

const STATUSES = ['idle', 'busy', 'working', 'offline'];
const EMOTIONS = ['neutral', 'focused', 'thinking', 'happy', 'stressed', 'celebrating', 'sleepy'];

interface ControlPanelProps {
  onSendEvent: (event: GameEvent) => void;
}

export function ControlPanel({ onSendEvent }: ControlPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState('alice');
  const [selectedStatus, setSelectedStatus] = useState('working');
  const [selectedEmotion, setSelectedEmotion] = useState('happy');
  const [taskDescription, setTaskDescription] = useState('');

  const handleSetStatus = useCallback(() => {
    onSendEvent({
      type: 'agent:status-change',
      timestamp: Date.now(),
      agentId: selectedAgent,
      status: selectedStatus as GameEvent['status' & keyof GameEvent] as 'idle' | 'busy' | 'working' | 'offline',
    } as GameEvent);
  }, [selectedAgent, selectedStatus, onSendEvent]);

  const handleAssignTask = useCallback(() => {
    onSendEvent({
      type: 'agent:task-assigned',
      timestamp: Date.now(),
      agentId: selectedAgent,
      taskId: `task-${Date.now()}`,
      taskType: 'manual',
      description: taskDescription || 'Manual task',
    });
  }, [selectedAgent, taskDescription, onSendEvent]);

  const handleChangeEmotion = useCallback(() => {
    onSendEvent({
      type: 'agent:emotion-change',
      timestamp: Date.now(),
      agentId: selectedAgent,
      emotion: selectedEmotion,
      source: 'manual',
    });
  }, [selectedAgent, selectedEmotion, onSendEvent]);

  return (
    <div className="glass rounded-xl p-4">
      <h2 className="text-lg font-bold gradient-text mb-3">Control Panel</h2>

      <div className="space-y-3">
        <div>
          <label className="text-gray-400 text-xs block mb-1" htmlFor="agent-select">Agent</label>
          <select
            id="agent-select"
            aria-label="Agent"
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="w-full bg-dark-50 border border-dark-100 rounded-lg px-3 py-2 text-white text-sm"
          >
            {AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-gray-400 text-xs block mb-1" htmlFor="status-select">Status</label>
          <select
            id="status-select"
            aria-label="Status"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full bg-dark-50 border border-dark-100 rounded-lg px-3 py-2 text-white text-sm"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSetStatus}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Set Status
        </button>

        <div>
          <input
            type="text"
            placeholder="Task description"
            value={taskDescription}
            onChange={e => setTaskDescription(e.target.value)}
            className="w-full bg-dark-50 border border-dark-100 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>

        <button
          onClick={handleAssignTask}
          className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Assign Task
        </button>

        <div>
          <label className="text-gray-400 text-xs block mb-1" htmlFor="emotion-select">Emotion</label>
          <select
            id="emotion-select"
            aria-label="Emotion"
            value={selectedEmotion}
            onChange={e => setSelectedEmotion(e.target.value)}
            className="w-full bg-dark-50 border border-dark-100 rounded-lg px-3 py-2 text-white text-sm"
          >
            {EMOTIONS.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleChangeEmotion}
          className="w-full py-2 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Change Emotion
        </button>
      </div>
    </div>
  );
}
