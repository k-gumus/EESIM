import { memo, useEffect, useRef } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { wireRegistry } from '../../sim/runner';

function WireEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 3, offset: 14 });
  const baseRef = useRef<SVGPathElement>(null);
  const dotsRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!baseRef.current || !dotsRef.current) return;
    const prev = wireRegistry.get(id);
    wireRegistry.set(id, { base: baseRef.current, dots: dotsRef.current, offset: prev?.offset ?? 0 });
    return () => {
      wireRegistry.delete(id);
    };
  }, [id]);

  return (
    <>
      <BaseEdge path={path} interactionWidth={14} style={{ stroke: 'transparent' }} />
      <path ref={baseRef} d={path} className={`wire ${selected ? 'selected' : ''}`} fill="none" />
      <path ref={dotsRef} d={path} className="wire-dots" fill="none" style={{ opacity: 0 }} />
    </>
  );
}

export const WireEdge = memo(WireEdgeImpl);
