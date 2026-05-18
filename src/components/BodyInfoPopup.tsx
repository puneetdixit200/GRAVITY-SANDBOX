"use client";

import { X, Zap } from "lucide-react";
import { Body, Vector, magnitude } from "@/engine/Simulation";

type BodyInfoPopupProps = {
  body: Body | null;
  anchor: Vector | null;
  onClose: () => void;
  onRemove: (body: Body) => void;
};

export function BodyInfoPopup({ body, anchor, onClose, onRemove }: BodyInfoPopupProps) {
  if (!body || !anchor) {
    return null;
  }

  return (
    <aside className="body-info" aria-label="Selected body details">
      <header>
        <div>
          <span className="eyebrow">{body.type}</span>
          <h2>{body.name}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close body details">
          <X size={16} />
        </button>
      </header>
      <dl className="body-metrics">
        <div>
          <dt>Mass</dt>
          <dd>{body.mass.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Radius</dt>
          <dd>{body.radius.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd>{magnitude(body.velocity).toFixed(2)}</dd>
        </div>
        <div>
          <dt>Acceleration</dt>
          <dd>{magnitude(body.acceleration).toFixed(3)}</dd>
        </div>
      </dl>
      <button className="danger-button" type="button" onClick={() => onRemove(body)}>
        <Zap size={14} />
        Remove
      </button>
    </aside>
  );
}
