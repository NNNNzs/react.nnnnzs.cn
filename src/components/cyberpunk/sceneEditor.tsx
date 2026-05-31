'use client';

import React, { useEffect, useRef } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { create } from 'zustand';
import * as THREE from 'three';

export const SCENE_EDITOR_TARGETS = [
  { id: 'workstation-zone', label: '工作台总成' },
  { id: 'living-core-zone', label: '客厅核心区' },
  { id: 'sleep-bed', label: '睡眠区' },
  { id: 'sleep-nightstand', label: '床头柜' },
  { id: 'sleep-poster', label: '床侧霓虹画' },
  { id: 'bookshelf', label: '书架' },
  { id: 'server-rack', label: '服务器架' },
  { id: 'data-ghost-sign', label: 'DATA GHOST 牌' },
  { id: 'kiroshi-index-sign', label: 'KIROSHI 牌' },
  { id: 'wardrobe-zone', label: '衣柜区' },
  { id: 'ceiling-floor-details', label: '天花与地面细节' },
  { id: 'neon-sign', label: '窗口霓虹牌' },
] as const;

export type SceneEditorTargetId = (typeof SCENE_EDITOR_TARGETS)[number]['id'];
export type SceneEditorMode = 'translate' | 'rotate' | 'scale';

type SceneEditorState = {
  selectedId: SceneEditorTargetId | null;
  mode: SceneEditorMode;
  enabled: boolean;
  setSelectedId: (id: SceneEditorTargetId | null) => void;
  setMode: (mode: SceneEditorMode) => void;
  setEnabled: (enabled: boolean) => void;
};

export const useSceneEditorStore = create<SceneEditorState>((set) => ({
  selectedId: null,
  mode: 'translate',
  enabled: false,
  setSelectedId: (selectedId) => set({ selectedId }),
  setMode: (mode) => set({ mode }),
  setEnabled: (enabled) => set({ enabled }),
}));

export const useSceneEditorEnabled = () => useSceneEditorStore((s) => s.enabled);

const sceneEditorRegistry = new Map<SceneEditorTargetId, React.RefObject<THREE.Object3D>>();
type EditableGroupProps = Omit<ThreeElements['group'], 'id'> & {
  id: SceneEditorTargetId;
};

export function useSceneEditorTargetRef<T extends THREE.Object3D>(id: SceneEditorTargetId) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    sceneEditorRegistry.set(id, ref as React.RefObject<THREE.Object3D>);
    return () => {
      sceneEditorRegistry.delete(id);
      const selectedId = useSceneEditorStore.getState().selectedId;
      if (selectedId === id) {
        useSceneEditorStore.getState().setSelectedId(null);
      }
    };
  }, [id]);

  return ref;
}

export function EditableGroup({
  id,
  children,
  ...props
}: React.PropsWithChildren<EditableGroupProps>) {
  const ref = useSceneEditorTargetRef<THREE.Group>(id);
  const setSelectedId = useSceneEditorStore((s) => s.setSelectedId);
  const enabled = useSceneEditorEnabled();

  return (
    <group
      ref={ref}
      {...props}
      onPointerDown={enabled ? (event) => {
        event.stopPropagation();
        setSelectedId(id);
      } : undefined}
    >
      {children}
    </group>
  );
}

export function SceneEditorTransformControls({ enabled }: { enabled: boolean }) {
  const selectedId = useSceneEditorStore((s) => s.selectedId);
  const mode = useSceneEditorStore((s) => s.mode);

  if (!enabled || !selectedId) return null;

  const targetRef = sceneEditorRegistry.get(selectedId);
  if (!targetRef) return null;

  return (
    <TransformControls
      object={targetRef}
      mode={mode}
      space="world"
      size={1.1}
      showX
      showY
      showZ
    />
  );
}
